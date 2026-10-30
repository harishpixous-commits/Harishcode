import { MessageTooLargeError, ndJsonStream } from "@agentclientprotocol/sdk"
import { HarishCode } from "@harishcode/client/effect"
import { Service } from "@harishcode/client/effect/service"
import { CrossSpawnSpawner } from "@harishcode/util/cross-spawn-spawner"
import { Effect, Option } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http"
import { Writable } from "node:stream"
import { ACP } from "../../acp/agent"
import { ACPTurn } from "../../acp/turn"
import { resolveReviewProfile } from "../../acp/guarded"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Standalone } from "../../services/standalone"

export default Runtime.handler(
  Commands.commands.acp,
  Effect.fn("cli.acp")(function* (input) {
    if (input.login) {
      const login = yield* Effect.promise(() => import("./auth/login"))
      return yield* login.default({
        target: Option.none(),
        method: Option.none(),
        answer: [],
      })
    }
    // Owner-controlled guarded review profile (process-launch configuration, never ACP request
    // metadata). Default stays "client"; guarded mode binds one workspace and never asks the client.
    const profile = yield* Effect.try({
      try: () =>
        resolveReviewProfile({
          permissionReview: input.permissionReview,
          reviewWorkspace: Option.getOrUndefined(input.reviewWorkspace),
          reviewTimeout: Option.getOrUndefined(input.reviewTimeout),
        }),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    })
    process.env.HARISHCODE_CLIENT = "acp"
    const endpoint = yield* Standalone.start()
    const client = yield* HarishCode.make({ baseUrl: endpoint.url }).pipe(
      Effect.provideServiceEffect(
        HttpClient.HttpClient,
        HttpClient.HttpClient.pipe(
          Effect.map(HttpClient.mapRequest(HttpClientRequest.setHeaders(Service.headers(endpoint) ?? {}))),
        ),
      ),
      Effect.provide(FetchHttpClient.layer),
    )
    const guardReview = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
      if (profile.mode !== "harishcode") return effect
      return effect.pipe(
        Effect.provideService(ACPTurn.PermissionReview, "harishcode"),
        Effect.provideService(ACPTurn.ReviewWorkspace, profile.workspace),
        Effect.provideService(ACPTurn.PermissionReviewTimeout, profile.timeout),
      )
    }
    const connection = yield* guardReview(
      ACP.connect(client, ndJsonStream(Writable.toWeb(process.stdout), Bun.stdin.stream())),
    )
    const failure = yield* Effect.raceFirst(
      Effect.promise(() => connection.closed).pipe(
        Effect.map(() =>
          connection.signal.reason instanceof MessageTooLargeError
            ? `incoming message exceeded the ${connection.signal.reason.maxMessageBytes / 1024 / 1024} MiB limit`
            : undefined,
        ),
      ),
      endpoint.exited.pipe(
        Effect.match({
          onSuccess: (code) => `code ${code}`,
          onFailure: (error) =>
            error.cause instanceof CrossSpawnSpawner.KilledBySignal ? `signal ${error.cause.signal}` : error.message,
        }),
        Effect.map((reason) => `server exited unexpectedly (${reason})`),
      ),
    )
    // Exit directly: closing the scope would wait on the server's graceful shutdown, and its lease pipe ends it anyway.
    yield* Effect.sync(() => {
      if (failure) process.stderr.write(`harishcode acp: ${failure}\n`)
      process.exit(failure ? 1 : 0)
    })
  }),
)
