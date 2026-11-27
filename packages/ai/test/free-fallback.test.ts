import { describe, expect, test } from "bun:test"
import { Effect, Stream } from "effect"
import { FreeFallback, LLM } from "../src/effect"
import { AIError, AuthenticationError, InvalidRequestError, RateLimitError } from "../src/schema/errors"
import { Google, OpenAICompatible } from "../src/providers"

const primary = Google.configure({ apiKey: "k1" }).model("primary-model")
const second = OpenAICompatible.configure({ provider: "second", baseURL: "http://x.test/v1", apiKey: "k2" }).model("second-model")
const third = OpenAICompatible.configure({ provider: "third", baseURL: "http://y.test/v1", apiKey: "k3" }).model("third-model")
const request = LLM.request({ model: primary, prompt: "hi" })

const text = (value: string) => ({ type: "text-delta", id: "t", text: value }) as any
const start = { type: "step-start", index: 0 } as any

// A fake client: each model id maps to a script of events or a failure; calls are recorded.
const client = (script: Record<string, ReadonlyArray<any> | AIError>) => {
  const calls: string[] = []
  return {
    calls,
    stream: (req: any) => {
      const id = `${req.model.provider}/${String(req.model.id)}`
      calls.push(id)
      const step = script[id]
      if (step instanceof AIError) return Stream.fail(step)
      return Stream.fromIterable(step ?? [])
    },
  } as any
}
const run = (c: any, fallbacks: any[], report?: any) =>
  Effect.runPromise(Stream.runCollect(FreeFallback.stream(c, request, fallbacks, undefined, report)).pipe(Effect.map((x) => Array.from(x))))

describe("FreeFallback", () => {
  test("uses the primary route when it works and never touches the others", async () => {
    const c = client({ "google/primary-model": [start, text("a")] })
    const events = await run(c, [second])
    expect(events.map((e: any) => e.type)).toEqual(["step-start", "text-delta"])
    expect(c.calls).toEqual(["google/primary-model"])
  })

  test("falls through on rate limit then auth failure, one attempt per route, and reports each", async () => {
    const reports: any[] = []
    const c = client({
      "google/primary-model": new AIError({ reason: new RateLimitError({ message: "limit" }) }),
      "second/second-model": new AIError({ reason: new AuthenticationError({ message: "bad key" }) }),
      "third/third-model": [start, text("ok")],
    })
    const events = await run(c, [second, third], (r: any) => reports.push(r))
    expect((events.at(-1) as any).text).toBe("ok")
    expect(c.calls).toEqual(["google/primary-model", "second/second-model", "third/third-model"])
    expect(reports.map((r) => `${r.route}:${r.outcome}`)).toEqual([
      "google/primary-model:RateLimit",
      "second/second-model:Authentication",
    ])
  })

  test("falls through on a provider-error event before any output (free usage limit)", async () => {
    const c = client({
      "google/primary-model": [start, { type: "provider-error", message: "Free usage limit reached" } as any],
      "second/second-model": [start, text("fine")],
    })
    const events = await run(c, [second])
    expect(events.map((e: any) => e.type)).toEqual(["step-start", "step-start", "text-delta"])
    expect(c.calls).toEqual(["google/primary-model", "second/second-model"])
  })

  test("does not switch once output has started, and does not fall back for a bad request", async () => {
    const mid = client({
      "google/primary-model": [text("partial"), { type: "provider-error", message: "boom" } as any],
      "second/second-model": [text("other")],
    })
    const events = await run(mid, [second])
    expect(events.map((e: any) => e.type)).toEqual(["text-delta", "provider-error"])
    expect(mid.calls).toEqual(["google/primary-model"])

    const bad = client({
      "google/primary-model": new AIError({ reason: new InvalidRequestError({ message: "bad" }) }),
      "second/second-model": [text("other")],
    })
    await expect(run(bad, [second])).rejects.toBeDefined()
    expect(bad.calls).toEqual(["google/primary-model"])
  })

  test("the last route's failure is reported, with no loop back", async () => {
    const c = client({
      "google/primary-model": new AIError({ reason: new RateLimitError({ message: "a" }) }),
      "second/second-model": new AIError({ reason: new RateLimitError({ message: "b" }) }),
    })
    await expect(run(c, [second])).rejects.toBeDefined()
    expect(c.calls).toEqual(["google/primary-model", "second/second-model"])
  })

  test("modelsFromEnv uses only keys in the environment and can be turned off", () => {
    expect(FreeFallback.modelsFromEnv({}).length).toBe(0)
    const both = FreeFallback.modelsFromEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "a", NVIDIA_API_KEY: "b" })
    expect(both.map((m) => m.provider)).toEqual(["google", "nvidia"])
    expect(FreeFallback.modelsFromEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "a", HARISHCODE_FREE_FALLBACK: "0" }).length).toBe(0)
  })
})
