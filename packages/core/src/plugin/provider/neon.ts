import { Effect } from "effect"
import { define } from "@harishcode/plugin/effect/plugin"

export const NeonPlugin = define({
  id: "harishcode.provider.neon",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.integration.transform((editor) => {
      // models.dev also lists NEON_AI_GATEWAY_BASE_URL, which only fills the base URL template.
      editor.method.update({ integrationID: "neon", method: { type: "env", names: ["NEON_AI_GATEWAY_TOKEN"] } })
    })
  }),
})
