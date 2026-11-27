import { Effect } from "effect"
import { AIClient, LLM } from "@harishcode/ai/effect"
import { Anthropic, Google, Groq, Mistral, OpenAI, OpenAICompatible, OpenRouter } from "@harishcode/ai/providers"

/**
 * Live connection check: one tiny request per provider that has a key in the environment.
 *
 *   GOOGLE_GENERATIVE_AI_API_KEY=... NVIDIA_API_KEY=... bun script/check-connection.ts [provider ...]
 *
 * Keys are read from the environment only and are never printed. Providers without a key
 * report NEEDS_KEY and make no network call. Each provider gets exactly one request, with no
 * retry, key rotation or fallback, so a rate limit or quota error is reported as FAILED and the
 * check stops there. Use free-tier keys only: a check can bill a paid account.
 * Override a model with CHECK_MODEL_<PROVIDER>, for example CHECK_MODEL_GOOGLE=gemini-flash-lite-latest.
 */
type Check = { name: string; env: string; model: string; make: (key: string, model: string) => any }

const checks: Check[] = [
  { name: "google", env: "GOOGLE_GENERATIVE_AI_API_KEY", model: "gemini-flash-lite-latest", make: (apiKey, m) => Google.configure({ apiKey }).model(m) },
  {
    name: "nvidia",
    env: "NVIDIA_API_KEY",
    model: "nvidia/nemotron-3.5-lightning-30b-a3b",
    make: (apiKey, m) =>
      OpenAICompatible.configure({ provider: "nvidia", baseURL: "https://integrate.api.nvidia.com/v1", apiKey }).model(m),
  },
  { name: "anthropic", env: "ANTHROPIC_API_KEY", model: "claude-3-5-haiku-latest", make: (apiKey, m) => Anthropic.configure({ apiKey }).model(m) },
  { name: "openai", env: "OPENAI_API_KEY", model: "gpt-4o-mini", make: (apiKey, m) => OpenAI.configure({ apiKey }).chat(m) },
  { name: "openrouter", env: "OPENROUTER_API_KEY", model: "meta-llama/llama-3.1-8b-instruct:free", make: (apiKey, m) => OpenRouter.configure({ apiKey }).model(m) },
  { name: "groq", env: "GROQ_API_KEY", model: "llama-3.1-8b-instant", make: (apiKey, m) => Groq.configure({ apiKey }).model(m) },
  { name: "mistral", env: "MISTRAL_API_KEY", model: "mistral-small-latest", make: (apiKey, m) => Mistral.configure({ apiKey }).model(m) },
]

const only = process.argv.slice(2)
const selected = only.length ? checks.filter((c) => only.includes(c.name)) : checks

const run = async (check: Check) => {
  const key = process.env[check.env]
  if (!key) return { name: check.name, status: "NEEDS_KEY", detail: `set ${check.env}` }
  const model = process.env[`CHECK_MODEL_${check.name.toUpperCase()}`] ?? check.model
  const started = Date.now()
  try {
    const response = await Effect.runPromise(
      LLM.generate(
        LLM.request({ model: check.make(key, model), prompt: "Reply with the single word: ok", generation: { maxTokens: 128, temperature: 0 } }),
      ).pipe(Effect.provide(AIClient.layer), Effect.timeout("30 seconds")),
    )
    const text = (response.events as any[]).filter((e) => e.type === "text-delta").map((e) => e.text).join("").trim()
    if (!text) return { name: check.name, status: "FAILED", detail: `${model}: empty response` }
    return { name: check.name, status: "OK", detail: `${model}: replied "${text.slice(0, 20)}" in ${Date.now() - started} ms (finish: ${(response as any).finishReason?.normalized ?? "n/a"})` }
  } catch (error) {
    // Never echo request headers; only the error class and message are shown, with the key masked.
    const message = String((error as Error)?.message ?? error).split(key).join("***").slice(0, 300)
    return { name: check.name, status: "FAILED", detail: `${model}: ${message}` }
  }
}

const results = []
for (const check of selected) results.push(await run(check))
for (const r of results) console.log(`${r.status.padEnd(9)} ${r.name.padEnd(11)} ${r.detail}`)
process.exit(results.some((r) => r.status === "FAILED") ? 1 : 0)
