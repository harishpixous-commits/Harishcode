import { Event } from "@harishcode/schema/event"
import { Effect, Stream } from "effect"
import { HttpServerResponse } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../api"
import { EventFeed } from "../event-feed"
import { ReviewerPresence } from "../reviewer-presence"

export const EventHandler = HttpApiBuilder.group(Api, "server.event", (handlers) =>
  Effect.gen(function* () {
    const feed = yield* EventFeed.Service
    const presence = yield* ReviewerPresence.Service
    return handlers.handleRaw("event.subscribe", (ctx) =>
      Effect.gen(function* () {
        const output = Stream.unwrap(
          Effect.gen(function* () {
            // Joining before the connected frame is emitted ties token delivery to registration:
            // a client that can read the token is already counted as a present reviewer, and the
            // token is revoked when this stream's scope closes.
            const reviewer = ctx.query.review === "true" ? yield* presence.join() : undefined
            const live = yield* feed.subscribe(ctx.query.types)
            const connected = {
              id: Event.ID.create(),
              type: "server.connected",
              data: reviewer ? { reviewer: reviewer.token } : {},
            } as const
            return Stream.make(EventFeed.frame(connected)).pipe(Stream.concat(live))
          }),
        )
        const heartbeat = Stream.tick("15 seconds").pipe(Stream.map(() => ": heartbeat\n\n"))
        return HttpServerResponse.stream(
          output.pipe(Stream.merge(heartbeat, { haltStrategy: "left" }), Stream.encodeText),
          {
            contentType: "text/event-stream",
            headers: {
              "Cache-Control": "no-cache, no-transform",
              "X-Accel-Buffering": "no",
              "X-Content-Type-Options": "nosniff",
            },
          },
        )
      }),
    )
  }),
)
