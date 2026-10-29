import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveReviewProfile } from "../../src/acp/guarded"
import {
  delivered,
  ephemeralEvent,
  permissionAsked,
  rpcError,
  startWire,
  succeeded,
  turn,
} from "./wire-fixture"

/** Launches the wire from the actual CLI profile resolver, not hand-set context values. */
const launchGuarded = async (
  run: (acp: Awaited<ReturnType<typeof startWire>> & { sessionId: string }, workspace: string) => Promise<void>,
  options: { reviewTimeout?: string; settleTurn?: "external" | "immediate" } = {},
) => {
  const workspace = mkdtempSync(join(tmpdir(), "hc-guarded-launch-"))
  try {
    const profile = resolveReviewProfile({
      permissionReview: "harishcode",
      reviewWorkspace: workspace,
      reviewTimeout: options.reviewTimeout,
    })
    if (profile.mode !== "harishcode") throw new Error("expected guarded profile")
    const acp = await startWire({
      permissionReview: profile.mode,
      reviewWorkspace: profile.workspace,
      permissionReviewTimeout: profile.timeout,
      // "external" keeps the turn open until an independent server settlement; "immediate" lets the
      // fixture complete the turn once the review outcome (approval or deadline reject) lands.
      onPrompt: ({ sessionID, id }) =>
        options.settleTurn === "immediate"
          ? turn(sessionID, id, permissionAsked(sessionID, "perm_launch"))
          : [delivered(sessionID, id), permissionAsked(sessionID, "perm_launch")],
      permission: () => {
        throw new Error("autoallow client must never be consulted")
      },
    })
    try {
      await acp.initialize()
      const session = await acp.newSession(profile.workspace)
      await run(Object.assign(acp, { sessionId: session.sessionId }), workspace)
    } finally {
      await acp[Symbol.asyncDispose]()
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
}

test("launched profile routes review to the HC server and never the client", async () =>
  launchGuarded(async (acp) => {
    expect(acp.server.sessions.get(acp.sessionId)?.metadata).toMatchObject({
      "harishcode.openhands.requireReview": true,
    })
    const prompt = acp.prompt(acp.sessionId, "fixture only")
    await acp.until(() => acp.server.submissions.length === 1, "prompt submitted")
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(acp.permissions).toHaveLength(0)
    acp.server.send(
      ephemeralEvent("permission.replied", { sessionID: acp.sessionId, requestID: "perm_launch", reply: "once" }),
      succeeded(acp.sessionId),
    )
    expect(await prompt).toMatchObject({ stopReason: "end_turn" })
    expect(acp.permissions).toHaveLength(0)
  }))

test("launched profile timeout rejects the pending review without client fallback", async () =>
  launchGuarded(
    async (acp) => {
      expect(await acp.prompt(acp.sessionId, "fixture only")).toMatchObject({ stopReason: "end_turn" })
      expect(acp.server.replies.map((reply) => [reply.requestID, reply.decision])).toEqual([["perm_launch", "reject"]])
      expect(acp.permissions).toHaveLength(0)
    },
    { reviewTimeout: "100", settleTurn: "immediate" },
  ))

test("launched profile refuses foreign workspaces and stripped-marker sessions", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "hc-guarded-launch-"))
  try {
    const profile = resolveReviewProfile({ permissionReview: "harishcode", reviewWorkspace: workspace })
    if (profile.mode !== "harishcode") throw new Error("expected guarded profile")
    await using acp = await startWire({ permissionReview: profile.mode, reviewWorkspace: profile.workspace })
    await acp.initialize()
    expect(await rpcError(acp.newSession("/elsewhere"))).toMatchObject({ code: -32602 })
    const created = await acp.newSession(profile.workspace)
    const session = acp.server.sessions.get(created.sessionId)!
    acp.server.sessions.set(created.sessionId, { ...session, metadata: {} })
    expect(await rpcError(acp.prompt(created.sessionId, "fixture only"))).toMatchObject({ code: -32602 })
    expect(acp.server.submissions).toHaveLength(0)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
