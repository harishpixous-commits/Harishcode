import { Instance } from "@harishcode/core/instance/service"
import { Location } from "@harishcode/core/location"
import { Permission } from "@harishcode/core/permission"
import { PermissionSaved } from "@harishcode/core/permission/saved"
import { Session } from "@harishcode/core/session"
import { Effect } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/http-api"
import { Api } from "../api"
import {
  ConflictError,
  ForbiddenError,
  PermissionNotFoundError,
  PermissionSavedNotFoundError,
} from "@harishcode/protocol/errors"
import { locationErrors, response, sessionInfo } from "../location"
import { ReviewerPresence } from "../reviewer-presence"
import { missingSession } from "./session-error"

function missingRequest(id: Permission.ID) {
  return new PermissionNotFoundError({ requestID: id, message: `Permission request not found: ${id}` })
}

export const PermissionHandler = HttpApiBuilder.group(Api, "server.permission", (handlers) =>
  Effect.gen(function* () {
    const instances = yield* Instance.Service
    const sessions = yield* Session.Service
    const presence = yield* ReviewerPresence.Service
    const requireOwnedRequest = Effect.fnUntraced(function* (
      sessionID: Permission.Request["sessionID"],
      requestID: Permission.ID,
    ) {
      const permission = yield* Permission.Service
      const request = yield* permission.get(requestID)
      if (!request || request.sessionID !== sessionID) return yield* missingRequest(requestID)
      return { permission, request }
    })

    return handlers
      .handle(
        "permission.request.list",
        Effect.fn(function* () {
          const permission = yield* Permission.Service
          return yield* response(permission.list())
        }),
      )
      .handle(
        "session.permission.create",
        Effect.fn(function* (ctx) {
          const permission = yield* Permission.Service
          return {
            data: yield* permission
              .ask({
                id: ctx.payload.id,
                sessionID: ctx.params.sessionID,
                action: ctx.payload.action,
                resources: ctx.payload.resources,
                save: ctx.payload.save,
                metadata: ctx.payload.metadata,
                source: ctx.payload.source,
                agent: ctx.payload.agent,
              })
              .pipe(Effect.catchTag("Session.NotFoundError", missingSession)),
          }
        }),
      )
      .handle(
        "session.permission.list",
        Effect.fn(function* (ctx) {
          const session = yield* sessionInfo(sessions, ctx.params.sessionID)
          const requests = yield* Permission.Service.use((permission) =>
            permission.forSession(ctx.params.sessionID),
          ).pipe(instances.provide(session), locationErrors)
          return { data: requests }
        }),
      )
      .handle(
        "session.permission.get",
        Effect.fn(function* (ctx) {
          const owned = yield* requireOwnedRequest(ctx.params.sessionID, ctx.params.requestID)
          return { data: owned.request }
        }),
      )
      .handle(
        "session.permission.reply",
        Effect.fn(function* (ctx) {
          const owned = yield* requireOwnedRequest(ctx.params.sessionID, ctx.params.requestID)
          let repliedBy: string | undefined
          if (ctx.payload.decision !== "reject" && (yield* owned.permission.reviewRequired(ctx.params.sessionID))) {
            // Guarded sessions accept approvals only from a connection holding a live reviewer
            // token (see ReviewerPresence). Rejects always go through so a missing or stale
            // token can never wedge a decline.
            const reviewer =
              ctx.payload.reviewer === undefined ? undefined : yield* presence.verify(ctx.payload.reviewer)
            if (reviewer === undefined)
              return yield* new ForbiddenError({
                message: "Guarded sessions may only be approved by a connected reviewing UI",
              })
            repliedBy = `reviewer:${reviewer}`
          }
          yield* owned.permission
            .reply({
              requestID: ctx.params.requestID,
              reply: ctx.payload.decision,
              message: ctx.payload.message,
              repliedBy,
            })
            .pipe(Effect.catchTag("Permission.NotFoundError", () => missingRequest(ctx.params.requestID)))
          return HttpApiSchema.NoContent.make()
        }),
      )
      .handle(
        "permission.saved.list",
        Effect.fn(function* (ctx) {
          const location = yield* Location.Service
          const saved = yield* PermissionSaved.Service
          return {
            data: yield* saved.list({
              projectID: ctx.query.projectID ?? location.project.id,
            }),
          }
        }),
      )
      .handle(
        "permission.saved.update",
        Effect.fn(function* (ctx) {
          const saved = yield* PermissionSaved.Service
          return {
            data: yield* saved
              .update({ id: ctx.params.id, action: ctx.payload.action, resource: ctx.payload.resource })
              .pipe(
                Effect.catchTags({
                  "PermissionSaved.NotFoundError": (error) =>
                    new PermissionSavedNotFoundError({
                      id: error.id,
                      message: `Saved permission not found: ${error.id}`,
                    }),
                  "PermissionSaved.ConflictError": (error) =>
                    new ConflictError({
                      resource: error.id,
                      message: `A saved permission already allows ${error.action} for ${error.resource}`,
                    }),
                }),
              ),
          }
        }),
      )
      .handle(
        "permission.saved.remove",
        Effect.fn(function* (ctx) {
          const saved = yield* PermissionSaved.Service
          yield* saved.remove(ctx.params.id)
          return HttpApiSchema.NoContent.make()
        }),
      )
  }),
)
