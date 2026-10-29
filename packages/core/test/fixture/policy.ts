import { Config } from "@harishcode/core/config"
import { ConfigIntegration } from "@harishcode/core/config/integration"
import { ConfigPolicyPlugin } from "@harishcode/core/config/plugin/policy"
import { Integration } from "@harishcode/core/integration"
import { Mcp } from "@harishcode/core/mcp/index"
import { Skill } from "@harishcode/core/skill"
import { Info } from "@harishcode/schema/config"
import { ConfigPolicy } from "@harishcode/schema/config/policy"
import { ID } from "@harishcode/schema/event"
import { Effect, Schema, Stream } from "effect"
import { host } from "../plugin/host"

/** A connected organization's policy as the HarishCode Console delivers it: an integration config document. */
export function organizationPolicy(policies: ConfigPolicy.Info[], organization?: string) {
  return new ConfigIntegration.Document({
    type: "document",
    integrationID: Integration.ID.make("harishcode"),
    connection: { type: "env", name: "HARISHCODE_API_KEY" },
    organization,
    info: Schema.decodeUnknownSync(Info)({ policies }),
  })
}

/** Replaces the connected organization's policy, or removes it; publish `Event.Updated` to make plugins reload. */
export const setOrganizationPolicy = Effect.fn(function* (policies: ConfigPolicy.Info[] | undefined) {
  const config = yield* Config.Service
  yield* config.integration?.(Integration.ID.make("harishcode"), policies && organizationPolicy(policies)) ?? Effect.void
})

// Exercise the real policy plugin against supplied catalogs without unrelated provider/permission setup.
export const registerIntegrationPolicy = Effect.fn(function* (input: {
  mcp?: Mcp.Interface
  skill?: Skill.Interface
  events?: Stream.Stream<{ readonly type: string }, unknown>
}) {
  yield* ConfigPolicyPlugin.Plugin.effect(
    host({
      event: {
        subscribe: () =>
          (input.events ?? Stream.never).pipe(
            Stream.filter((event) => event.type === "config.updated"),
            Stream.map(() => ({ id: ID.create(), created: Date.now(), type: "config.updated" as const, data: {} })),
          ),
      },
      provider: {
        list: () => Effect.die("unused provider.list"),
        get: () => Effect.die("unused provider.get"),
        transform: () => Effect.succeed({ dispose: Effect.void }),
        reload: () => Effect.void,
      },
      mcp: {
        list: () => Effect.die("unused mcp.list"),
        transform: (callback) => input.mcp?.transform(callback) ?? Effect.succeed({ dispose: Effect.void }),
        reload: () => input.mcp?.reload() ?? Effect.void,
      },
      skill: {
        list: () => Effect.die("unused skill.list"),
        transform: (callback) => input.skill?.transform(callback) ?? Effect.succeed({ dispose: Effect.void }),
        reload: () => input.skill?.reload() ?? Effect.void,
      },
      permission: {
        hook: () => Effect.succeed({ dispose: Effect.void }),
        list: () => Effect.die("unused permission.list"),
        get: () => Effect.die("unused permission.get"),
        reply: () => Effect.die("unused permission.reply"),
        assert: () => Effect.die("unused permission.assert"),
      },
    }),
  )
})
