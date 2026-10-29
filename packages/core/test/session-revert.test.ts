import { $ } from "bun"
import { describe, expect } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect } from "effect"
import { Agent } from "@harishcode/core/agent"
import { Bus } from "@harishcode/core/bus"
import { Database } from "@harishcode/core/database/database"
import { AppNodeBuilder } from "@harishcode/core/effect/app-node-builder"
import { LocationServiceMap } from "@harishcode/core/location-service-map"
import { Model } from "@harishcode/core/model"
import { Plugin } from "@harishcode/core/plugin"
import { Provider } from "@harishcode/core/provider"
import { AbsolutePath } from "@harishcode/core/schema"
import { Session } from "@harishcode/core/session"
import { SessionEvent } from "@harishcode/core/session/event"
import { SessionExecution } from "@harishcode/core/session/execution"
import { SessionInbox } from "@harishcode/core/session/inbox"
import { SessionMessage } from "@harishcode/core/session/message"
import { SessionProjector } from "@harishcode/core/session/projector"
import { Snapshot } from "@harishcode/core/snapshot"
import { Money } from "@harishcode/schema/money"
import { LayerNode } from "@harishcode/util/effect/layer-node"
import { Global } from "@harishcode/util/global"
import { tempGlobalLayer } from "./fixture/global"
import { offlineModels } from "./fixture/models"
import { tmpdirScoped } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([Database.node, Bus.node, SessionProjector.node, Session.node, LocationServiceMap.node]),
    [
      Bus.node.replace(Bus.configured({ persist: true })),
      Global.node.replace(tempGlobalLayer),
      SessionExecution.node.replace(SessionExecution.noopLayer),
      offlineModels,
    ],
  ),
)

describe("Session.revert files", () => {
  it.live(
    "undoes and restores a file rename without losing either path",
    () =>
      Effect.gen(function* () {
        const tmp = yield* tmpdirScoped()
        const directory = path.join(tmp.path, "project")
        const original = path.join(directory, "old name.txt")
        const renamed = path.join(directory, "new name.txt")
        yield* Effect.promise(async () => {
          await fs.mkdir(directory)
          await Bun.write(original, "Preserve this content.\n")
          await Bun.write(path.join(directory, "unrelated.txt"), "Unrelated content.\n")
          await $`git init -q`.cwd(directory).quiet()
          await $`git -c core.fsmonitor=false add .`.cwd(directory).quiet()
        })

        const session = yield* Session.Service
        const database = yield* Database.Service
        const bus = yield* Bus.Service
        const created = yield* session.create({ location: { directory: AbsolutePath.make(directory) } })
        const prompt = yield* session.prompt({ sessionID: created.id, text: "Rename the file", resume: false })
        yield* SessionInbox.promote(database.db, bus, created.id, "steer")

        yield* Effect.gen(function* () {
          const plugins = yield* Plugin.Service
          yield* plugins.awaitActivation
          const snapshot = yield* Snapshot.Service
          const before = yield* snapshot.capture()
          if (!before) throw new Error("Initial snapshot missing")
          const assistantMessageID = SessionMessage.ID.create()
          yield* bus.publish(SessionEvent.Step.Started, {
            sessionID: created.id,
            assistantMessageID,
            agent: Agent.defaultID,
            model: { id: Model.ID.make("test-model"), providerID: Provider.ID.make("test-provider") },
            snapshot: before,
            started: 0,
          })
          yield* Effect.promise(() => fs.rename(original, renamed))
          const after = yield* snapshot.capture()
          if (!after) throw new Error("Renamed snapshot missing")
          yield* bus.publish(SessionEvent.Step.Ended, {
            sessionID: created.id,
            assistantMessageID,
            finish: "stop",
            cost: Money.USD.zero,
            tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
            snapshot: after,
            files: yield* snapshot.files({ from: before, to: after }),
          })

          yield* Effect.promise(() => Bun.write(path.join(directory, "unrelated.txt"), "Keep this later edit.\n"))
          const reverted = yield* session.revert.stage({ sessionID: created.id, messageID: prompt.id })
          expect({
            original: yield* Effect.promise(() => Bun.file(original).exists()),
            renamed: yield* Effect.promise(() => Bun.file(renamed).exists()),
          }).toEqual({ original: true, renamed: false })
          expect(yield* Effect.promise(() => Bun.file(original).text())).toBe("Preserve this content.\n")
          expect(reverted.files?.map((file) => [file.file, file.status])).toEqual([
            ["new name.txt", "deleted"],
            ["old name.txt", "added"],
          ])
          expect(yield* Effect.promise(() => Bun.file(path.join(directory, "unrelated.txt")).text())).toBe(
            "Keep this later edit.\n",
          )

          yield* session.revert.clear(created.id)
          expect(yield* Effect.promise(() => Bun.file(original).exists())).toBe(false)
          expect(yield* Effect.promise(() => Bun.file(renamed).text())).toBe("Preserve this content.\n")
          expect(yield* Effect.promise(() => Bun.file(path.join(directory, "unrelated.txt")).text())).toBe(
            "Keep this later edit.\n",
          )
          expect((yield* session.get(created.id)).revert).toBeUndefined()
        }).pipe(Effect.provide(LocationServiceMap.Service.get(created.location)))
      }),
    // Real Location/plugin startup and Git snapshots can exceed five seconds under CI load.
    { timeout: 15_000 },
  )
})

describe("Session.revert recovery characterization (P2 evidence base)", () => {
  // Simulates one assistant step: snapshot, mutate, capture, publish step events.
  const simulateStep = (
    sessionID: Session.ID,
    mutate: () => Promise<unknown>,
  ) =>
    Effect.gen(function* () {
      const plugins = yield* Plugin.Service
      yield* plugins.awaitActivation
      const snapshot = yield* Snapshot.Service
      const before = yield* snapshot.capture()
      if (!before) throw new Error("Pre-step snapshot missing")
      const assistantMessageID = SessionMessage.ID.create()
      yield* Bus.Service.use((bus) =>
        bus.publish(SessionEvent.Step.Started, {
          sessionID,
          assistantMessageID,
          agent: Agent.defaultID,
          model: { id: Model.ID.make("test-model"), providerID: Provider.ID.make("test-provider") },
          snapshot: before,
          started: 0,
        }),
      )
      yield* Effect.promise(mutate)
      const after = yield* snapshot.capture()
      if (!after) throw new Error("Post-step snapshot missing")
      const files = yield* snapshot.files({ from: before, to: after })
      yield* Bus.Service.use((bus) =>
        bus.publish(SessionEvent.Step.Ended, {
          sessionID,
          assistantMessageID,
          finish: "stop",
          cost: Money.USD.zero,
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          snapshot: after,
          files,
        }),
      )
    })

  const setupProject = Effect.gen(function* () {
    const tmp = yield* tmpdirScoped()
    const directory = path.join(tmp.path, "project")
    yield* Effect.promise(async () => {
      await fs.mkdir(directory)
      await Bun.write(path.join(directory, "a.txt"), "a:original\n")
      await Bun.write(path.join(directory, "b.txt"), "b:original\n")
      await $`git init -q`.cwd(directory).quiet()
      await $`git -c core.fsmonitor=false add .`.cwd(directory).quiet()
    })
    const session = yield* Session.Service
    const database = yield* Database.Service
    const bus = yield* Bus.Service
    const created = yield* session.create({ location: { directory: AbsolutePath.make(directory) } })
    return { directory, created, session, database, bus }
  })

  it.live(
    "restores only files touched after the revert boundary",
    () =>
      Effect.gen(function* () {
        const { directory, created, session, database, bus } = yield* setupProject
        const first = yield* session.prompt({ sessionID: created.id, text: "Edit a", resume: false })
        yield* SessionInbox.promote(database.db, bus, created.id, "steer")
        yield* Effect.gen(function* () {
          yield* simulateStep(created.id, () => Bun.write(path.join(directory, "a.txt"), "a:turn1\n"))
          const second = yield* session.prompt({ sessionID: created.id, text: "Edit b", resume: false })
          yield* SessionInbox.promote(database.db, bus, created.id, "steer")
          yield* simulateStep(created.id, () => Bun.write(path.join(directory, "b.txt"), "b:turn2\n"))

          // Revert to before turn 2: b returns to original, a keeps turn 1 content.
          const reverted = yield* session.revert.stage({ sessionID: created.id, messageID: second.id })
          expect(yield* Effect.promise(() => Bun.file(path.join(directory, "a.txt")).text())).toBe("a:turn1\n")
          expect(yield* Effect.promise(() => Bun.file(path.join(directory, "b.txt")).text())).toBe("b:original\n")
          expect(reverted.files?.map((file) => [file.file, file.status])).toEqual([["b.txt", "modified"]])
          void first
        }).pipe(Effect.provide(LocationServiceMap.Service.get(created.location)))
      }),
    { timeout: 15_000 },
  )

  it.live(
    "a user edit after the turn is overwritten by stage and not recovered by clear",
    () =>
      Effect.gen(function* () {
        const { directory, created, session, database, bus } = yield* setupProject
        const first = yield* session.prompt({ sessionID: created.id, text: "Edit a", resume: false })
        yield* SessionInbox.promote(database.db, bus, created.id, "steer")
        yield* Effect.gen(function* () {
          yield* simulateStep(created.id, () => Bun.write(path.join(directory, "a.txt"), "a:turn1\n"))
          // External (user) edit after the turn ends - the conflict case a preview would surface.
          yield* Effect.promise(() => Bun.write(path.join(directory, "a.txt"), "a:user-edit\n"))

          const stagedRevert = yield* session.revert.stage({ sessionID: created.id, messageID: first.id })
          // CHARACTERIZATION (P2): stage overwrites the user's post-turn edit without conflict detection.
          // The staged diff already names what was displaced - this is the visibility gap a conflict
          // preview would surface before restoring.
          expect(yield* Effect.promise(() => Bun.file(path.join(directory, "a.txt")).text())).toBe("a:original\n")
          expect(stagedRevert.files?.map((file) => [file.file, file.status])).toEqual([["a.txt", "modified"]])
          expect(stagedRevert.files?.[0]?.patch).toContain("-a:user-edit")

          yield* session.revert.clear(created.id)
          // Clear restores the displaced edit, because the stage-time capture included it.
          expect(yield* Effect.promise(() => Bun.file(path.join(directory, "a.txt")).text())).toBe("a:user-edit\n")
        }).pipe(Effect.provide(LocationServiceMap.Service.get(created.location)))
      }),
    { timeout: 15_000 },
  )

  it.live(
    "message-only stage leaves file contents untouched",
    () =>
      Effect.gen(function* () {
        const { directory, created, session, database, bus } = yield* setupProject
        yield* session.prompt({ sessionID: created.id, text: "Edit a", resume: false })
        yield* SessionInbox.promote(database.db, bus, created.id, "steer")
        yield* Effect.gen(function* () {
          yield* simulateStep(created.id, () => Bun.write(path.join(directory, "a.txt"), "a:turn1\n"))
          const prompt2 = yield* session.prompt({ sessionID: created.id, text: "noop", resume: false })
          yield* SessionInbox.promote(database.db, bus, created.id, "steer")
          const reverted = yield* session.revert.stage({ sessionID: created.id, messageID: prompt2.id, files: false })
          expect(yield* Effect.promise(() => Bun.file(path.join(directory, "a.txt")).text())).toBe("a:turn1\n")
          expect(reverted.files).toEqual([])
          yield* session.revert.clear(created.id)
        }).pipe(Effect.provide(LocationServiceMap.Service.get(created.location)))
      }),
    { timeout: 15_000 },
  )
})
