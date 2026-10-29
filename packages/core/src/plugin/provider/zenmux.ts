import { Effect } from "effect"
import { define } from "@harishcode/plugin/effect/plugin"

export const ZenmuxPlugin = define({
  id: "harishcode.provider.zenmux",
  effect: Effect.fn(function* (ctx) {
    yield* ctx.provider.transform((evt) => {
      for (const item of evt.list()) {
        if (item.provider.package !== "@harishcode/ai/providers/openai-compatible") continue
        if (item.provider.settings?.baseURL !== "https://zenmux.ai/api/v1") continue
        evt.update(item.provider.id, (provider) => {
          provider.headers = {
            "HTTP-Referer": "https://harishcode.ai/",
            "X-Title": "harishcode",
            ...provider.headers,
          }
        })
      }
    })
  }),
})
