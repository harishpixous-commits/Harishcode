export * as FreeFallback from "./free-fallback.js"

import { Effect, Stream } from "effect"
import type { Interface as LLMClientShape } from "./route/client.js"
import { LLMRequest, type AIError, type LLMEvent, type LanguageModel } from "./schema/index.js"
import type { StreamOptions } from "./route/client.js"
import { Google, OpenAICompatible } from "./providers.js"

/**
 * Free-route fallback. Tries the primary model first, then each configured fallback model in order, moving on only
 * when a route fails before it produced any output.
 *
 * Rules, on purpose:
 * - one attempt per route per call; a failed route is not retried and no other key is swapped in for it;
 * - a rate limit, quota or auth failure moves to the next route, it never loops back to the same one;
 * - only keys the user put in the environment are used, and nothing is added that can bill an account;
 * - once a route has streamed output, a later failure is reported as is, so a reply is never mixed from two models.
 */

const FALLBACK_REASONS = new Set([
  "Authentication",
  "RateLimit",
  "QuotaExceeded",
  "ProviderInternal",
  "Transport",
  "Timeout",
  "NoRoute",
  "UnknownProvider",
  "InvalidProviderOutput",
])

/** Whether a failed route should hand over to the next one. A malformed request or a policy refusal would fail everywhere. */
// A free model that was retired or is out of capacity answers as an invalid request ("Model is unavailable");
// that is a route problem, not a problem with the user's request, so the next route gets a turn.
const ROUTE_UNAVAILABLE = /unavailable|not found|no longer|deprecated|retired|not supported|overloaded|capacity|usage limit/i
export const shouldFallBack = (error: AIError) =>
  FALLBACK_REASONS.has(error.reason._tag) ||
  (error.reason._tag === "InvalidRequest" && ROUTE_UNAVAILABLE.test(String((error.reason as any).message ?? error.message ?? "")))

const outputStarted = (event: LLMEvent) =>
  /delta$/.test(event.type) || event.type === "tool-call" || event.type === "media" || event.type === "tool-input-start"

type Attempt = { readonly route: string; readonly outcome: string }
export type Report = (attempt: Attempt) => void

/**
 * Stream with fallback. `fallbacks` are tried in order after the primary model fails before output.
 * `report` is called once per failed route (route name and error class only, never keys or request bodies).
 */
export const stream = (
  client: Pick<LLMClientShape, "stream">,
  request: LLMRequest,
  fallbacks: ReadonlyArray<LanguageModel>,
  options?: StreamOptions,
  report?: Report,
): Stream.Stream<LLMEvent, AIError> => {
  if (fallbacks.length === 0) return client.stream(request, options)
  const routes = [request.model, ...fallbacks]
  const label = (model: LanguageModel) => `${model.provider}/${String(model.id)}`
  const run = (index: number): Stream.Stream<LLMEvent, AIError> => {
    const last = index === routes.length - 1
    const current = index === 0 ? request : LLMRequest.update(request, { model: routes[index] })
    let started = false
    const next = (outcome: string) =>
      Effect.sync(() => report?.({ route: label(routes[index]), outcome })).pipe(Effect.as(run(index + 1)))
    return client.stream(current, options).pipe(
      Stream.flatMap((event) => {
        if (event.type === "provider-error" && !started && !last && event.classification !== "context-overflow")
          return Stream.unwrap(next(`provider-error: ${event.message.slice(0, 80)}`))
        if (outputStarted(event)) started = true
        return Stream.make(event)
      }),
      Stream.catch((error: AIError) =>
        !started && !last && shouldFallBack(error)
          ? Stream.unwrap(next(error.reason._tag))
          : Stream.fail(error),
      ),
    )
  }
  return run(0)
}

export interface EnvConfig {
  readonly [name: string]: string | undefined
}

/**
 * Fallback models from the environment, in this order: Google (GOOGLE_GENERATIVE_AI_API_KEY), then NVIDIA
 * (NVIDIA_API_KEY). Models can be overridden with HARISHCODE_FALLBACK_GOOGLE_MODEL / HARISHCODE_FALLBACK_NVIDIA_MODEL.
 * Set HARISHCODE_FREE_FALLBACK=0 to turn the fallback off. Use free-tier keys only.
 */
export const modelsFromEnv = (env: EnvConfig): ReadonlyArray<LanguageModel> => {
  if (["0", "false", "off"].includes(env.HARISHCODE_FREE_FALLBACK?.toLowerCase() ?? "")) return []
  const models: LanguageModel[] = []
  const google = env.GOOGLE_GENERATIVE_AI_API_KEY
  if (google)
    models.push(
      Google.configure({ apiKey: google }).model(env.HARISHCODE_FALLBACK_GOOGLE_MODEL ?? "gemini-flash-lite-latest"),
    )
  const nvidia = env.NVIDIA_API_KEY
  if (nvidia)
    models.push(
      OpenAICompatible.configure({
        provider: "nvidia",
        baseURL: "https://integrate.api.nvidia.com/v1",
        apiKey: nvidia,
      }).model(env.HARISHCODE_FALLBACK_NVIDIA_MODEL ?? "nvidia/nemotron-3.5-lightning-30b-a3b"),
    )
  return models
}
