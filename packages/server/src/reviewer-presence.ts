export * as ReviewerPresence from "./reviewer-presence"

import { Bus } from "@harishcode/core/bus"
import { Instance } from "@harishcode/core/instance/service"
import { Permission } from "@harishcode/core/permission"
import { Session } from "@harishcode/core/session"
import type { Event } from "@harishcode/schema/event"
import { Context, Effect, Layer, Scope } from "effect"
import { randomBytes } from "node:crypto"

/**
 * Reviewer presence for guarded permission review.
 *
 * A reviewer is an event-feed subscription that declared review intent (review=true). Joining
 * issues a capability token, delivered to that connection only, in its initial server.connected
 * event. The token is the whole capability: guarded sessions accept allow decisions ("once" /
 * "always") only from a connection holding a live token, while rejects stay tokenless so a
 * missing or stale token can never wedge a decline. Tokens die with their connection; when the
 * last reviewer leaves, pending guarded asks are rejected rather than left waiting, and a
 * reconnect gets a fresh token with no resume (fail closed by construction).
 *
 * Honest scope: this is transport binding, not a multi-user authorization boundary. The server
 * authenticates a single fixed username today, so any client able to open an event stream can
 * declare itself a reviewer. What the gate refuses is the actual failure modes it was built
 * for: settles with no token (replayed or hand-built requests), settles from connections that
 * never subscribed, and settles on tokens whose connection already dropped. Pairing-scoped
 * reviewer identity is the follow-up.
 */
export interface Reviewer {
  readonly id: string
  readonly token: string
}

export interface Interface {
  /** Number of connected reviewer subscriptions. */
  readonly count: () => Effect.Effect<number>
  /** Resolves a live reviewer token to its reviewer id; undefined for unknown or revoked tokens. */
  readonly verify: (token: string) => Effect.Effect<string | undefined>
  /**
   * Registers a reviewer subscription, scoped to the caller: closing the scope (stream end or
   * client disconnect) revokes the token and, when the last reviewer leaves, rejects pending
   * guarded asks.
   */
  readonly join: () => Effect.Effect<Reviewer, never, Scope.Scope>
}

export class Service extends Context.Service<Service, Interface>()("@harishcode/server/ReviewerPresence") {}

const NO_REVIEWER = "No reviewer connected: guarded sessions require a live reviewing UI"
const REVIEWER_LEFT = "Reviewer disconnected: guarded review cannot continue without a reviewing UI"

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const bus = yield* Bus.Service
    const instances = yield* Instance.Service
    const sessions = yield* Session.Service

    const reviewers = new Map<string, string>()
    const pendingGuarded = new Map<Permission.ID, Session.Info>()

    const rejectGuarded = (requestID: Permission.ID, session: Session.Info, message: string) =>
      Permission.Service.use((permission) => permission.reply({ requestID, reply: "reject", message })).pipe(
        instances.provide(session),
        Effect.catchTag("Permission.NotFoundError", () => Effect.void),
        Effect.catchCause((cause) => Effect.logWarning("Guarded permission auto-reject failed", { requestID, cause })),
      )

    // Without a reviewer no guarded ask may wait for one: reject at creation, and reject every
    // tracked pending ask when the last reviewer leaves.
    const reviewerless = Effect.fnUntraced(function* () {
      const pending = Array.from(pendingGuarded)
      pendingGuarded.clear()
      yield* Effect.forEach(pending, ([requestID, session]) => rejectGuarded(requestID, session, REVIEWER_LEFT), {
        discard: true,
      })
    })

    const listener = (event: Event.Payload): Effect.Effect<void> => {
      if (event.type === Permission.Event.Replied.type) {
        const replied = event as Event.Payload<typeof Permission.Event.Replied>
        return Effect.sync(() => pendingGuarded.delete(replied.data.requestID))
      }
      if (event.type !== Permission.Event.Asked.type) return Effect.void
      const asked = event as Event.Payload<typeof Permission.Event.Asked>
      return Effect.suspend(() =>
        Effect.gen(function* () {
          const session = yield* sessions
            .get(asked.data.sessionID)
            .pipe(Effect.catchTag("Session.NotFoundError", () => Effect.succeed(undefined)))
          if (!session) return
          // Unknown is treated as guarded: a review check that cannot run must not wave an ask through.
          const guarded = yield* Permission.Service.use((permission) => permission.reviewRequired(session.id)).pipe(
            instances.provide(session),
            Effect.catchCause((cause) =>
              Effect.logWarning("Guarded review check failed; treating ask as guarded", {
                sessionID: session.id,
                cause,
              }).pipe(Effect.as(true)),
            ),
          )
          if (!guarded) return
          if (reviewers.size > 0) {
            pendingGuarded.set(asked.data.id, session)
            return
          }
          yield* rejectGuarded(asked.data.id, session, NO_REVIEWER)
        }),
      )
    }
    const unsubscribe = yield* bus.listen(listener)
    yield* Effect.addFinalizer(() => unsubscribe)

    return Service.of({
      count: () => Effect.sync(() => reviewers.size),
      verify: (token) => Effect.sync(() => reviewers.get(token)),
      join: () =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const reviewer = {
              id: randomBytes(6).toString("base64url"),
              token: randomBytes(24).toString("base64url"),
            }
            reviewers.set(reviewer.token, reviewer.id)
            return reviewer
          }),
          (reviewer) =>
            Effect.suspend(() => {
              if (!reviewers.delete(reviewer.token)) return Effect.void
              return reviewers.size === 0 ? reviewerless() : Effect.void
            }),
        ),
    })
  }),
)
