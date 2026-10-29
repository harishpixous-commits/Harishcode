export * as CodeModeWeb from "./web.js"

import { Extension } from "@harishcode/codemode"
import { isRecord } from "@harishcode/util/record"
import { Context, Effect } from "effect"

const TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 10
const redirectStatuses = new Set([301, 302, 303, 307, 308])

type Init = {
  readonly method?: string
  readonly headers?: Record<string, string> | Array<[string, string]>
  readonly body?: string | Uint8Array<ArrayBuffer> | URLSearchParams
}

/** Per-request mediation for model-written fetch calls. */
export type GuardService = {
  /** Interactive approval for the initial request URL. */
  readonly approve: (url: string, method: string) => Effect.Effect<void, Error>
  /** Non-interactive check for each redirect target; a denied target fails the request. */
  readonly check: (url: string) => Effect.Effect<void, Error>
}

/**
 * Per-execution mediation for model-written fetch calls. The execute tool provides this from the calling
 * session's permission service; it is deliberately not a global, so no module import can install a bypass.
 */
export class Guard extends Context.Service<Guard, GuardService>()("@harishcode/CodeModeWeb/Guard") {}

type Fetched = {
  readonly response: globalThis.Response
  readonly url: string
  readonly redirected: boolean
}

const hop = (url: string, init: Init) =>
  Effect.tryPromise({
    try: () =>
      globalThis.fetch(url, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }),
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  })

// Redirects are followed here instead of in fetch so each new URL is checked against the permission rules first.
const request = (url: string, init: Init, redirects: number): Effect.Effect<Fetched, Error, Guard> =>
  Effect.gen(function* () {
    const response = yield* hop(url, init)
    const location = response.headers.get("location")
    if (!redirectStatuses.has(response.status) || !location) return { response, url, redirected: redirects > 0 }
    if (redirects >= MAX_REDIRECTS)
      return yield* Effect.fail(new Error(`Too many redirects (more than ${MAX_REDIRECTS})`))
    const target = yield* Effect.try({
      try: () => new URL(location, url),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    })
    if (target.protocol !== "http:" && target.protocol !== "https:")
      return yield* Effect.fail(new Error("Redirect target must use http:// or https://"))
    yield* (yield* Guard).check(target.href)
    // 301/302/303 downgrade to GET without a body; 307/308 preserve method and body.
    const method = (init.method ?? "GET").toUpperCase()
    const downgrade = response.status !== 307 && response.status !== 308 && method !== "GET" && method !== "HEAD"
    return yield* request(target.href, downgrade ? { headers: init.headers } : init, redirects + 1)
  })

const fetch = Extension.async((input: string | URL, init: Init = {}) =>
  Effect.gen(function* () {
    if (URL.parse(String(input))?.protocol === "file:")
      return yield* Effect.fail(new Error("fetch cannot be used for filesystem access."))
    const guard = yield* Guard
    const method = typeof init.method === "string" ? init.method.toUpperCase() : "GET"
    yield* guard.approve(String(input), method)
    const { response, url, redirected } = yield* request(String(input), init, 0)
    const bytes = yield* Effect.tryPromise({
      try: () => response.bytes(),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    })
    const headers = Object.fromEntries(response.headers)
    const text = () => new TextDecoder().decode(bytes)
    return {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      redirected,
      headers: {
        get: (name: string) => headers[name.toLowerCase()] ?? null,
        has: (name: string) => name.toLowerCase() in headers,
        entries: () => Object.entries(headers),
      },
      text: async () => text(),
      json: async () => JSON.parse(text()) as unknown,
      bytes: async () => bytes,
    }
  }),
)

export const extension = Extension.make({ name: "web", globals: { fetch } })

/** What to show for a fetch call: its method and URL. */
export const display = (args: ReadonlyArray<unknown>) => {
  const [input, init] = args
  const method = isRecord(init) && typeof init.method === "string" ? init.method.toUpperCase() : "GET"
  return { method, url: String(input) }
}
