import { Effect, Stream } from "effect"
import { AIClient, FreeFallback, LLM } from "@harishcode/ai/effect"
import { LLMClientService } from "../src/route/client"
import { OpenAICompatible } from "@harishcode/ai/providers"
const primary = OpenAICompatible.configure({ provider: "harishcode", baseURL: "https://opencode.ai/inference/openai/v1", apiKey: "public" }).model(process.env.E2E_FREE_MODEL ?? "nemotron-3-ultra-free")
const request = LLM.request({ model: primary, prompt: "Reply with the single word: ok", generation: { maxTokens: 64 } })
const fallbacks = FreeFallback.modelsFromEnv(process.env as any)
const log: string[] = []
const program = Effect.gen(function* () {
  const client = yield* LLMClientService
  const events = yield* Stream.runCollect(FreeFallback.stream(client, request, fallbacks, undefined, (r: any) => log.push(JSON.stringify(r).split(process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "\0").join("***").slice(0, 200))))
  return Array.from(events)
})
const events: any[] = await Effect.runPromise(program.pipe(Effect.provide(AIClient.layer), Effect.timeout("40 seconds"))).catch((e: any) => { console.log("ERR", e?._tag, e?.reason?._tag ?? e?.reason, String(e?.message ?? e).slice(0, 250)); return [] })
console.log("fallback log:", log)
console.log("reply:", events.filter((e) => e.type === "text-delta").map((e) => e.text).join("").slice(0, 40))
