export * as CodeModeWeb from "./web.js"

import { Extension } from "@harishcode/codemode"
import { isRecord } from "@harishcode/util/record"
import { Context, Effect } from "effect"

const TIMEOUT_MS = 30_000
const MAX_REDIRECTS = 10
const redirectStatuses = new Set([301, 302, 303, 307, 308])

// Credential headers never forwarded when a redirect changes origin. Compared case-insensitively.
const SENSITIVE_HEADERS = new Set(["authorization", "proxy-authorization", "cookie", "cookie2"])

// Defense-in-depth only: cloud metadata endpoints are blocked before any guard or approval runs.
// This is NOT an SSRF boundary - IPv6 forms, DNS aliases and rebinding remain possible, and no
// localhost/private-range policy exists. The residual risk is documented in docs/openhands-integration.md.
const BLOCKED_HOSTS = new Set(["169.254.169.254", "metadata.google.internal"])

type HeaderEntries = Array<[string, string]>

type Init = {
  readonly method?: string
  readonly headers?: Record<string, string> | HeaderEntries | globalThis.Headers
  readonly body?: string | Uint8Array<ArrayBuffer> | URLSearchParams
  readonly credentials?: string
  readonly referrer?: string
}

const headerEntries = (headers: Init["headers"]): HeaderEntries => {
  if (!headers) return []
  if (Array.isArray(headers)) return headers
  if (headers instanceof globalThis.Headers) return [...headers.entries()]
  return Object.entries(headers)
}

const stripSensitive = (headers: HeaderEntries) =>
  headers.filter(([name]) => !SENSITIVE_HEADERS.has(name.toLowerCase()))

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
    try: (signal) =>
      globalThis.fetch(url, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        credentials: init.credentials as globalThis.RequestInit["credentials"],
        referrer: init.referrer,
        redirect: "manual",
        // External interruption aborts the in-flight request; the timeout still applies.
        signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
      }),
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  })

const assertTargetAllowed = (url: URL) => {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("URL must use http:// or https://")
  if (BLOCKED_HOSTS.has(url.hostname.toLowerCase())) throw new Error(`Requests to ${url.hostname} are not permitted`)
}

// Redirects are followed here instead of in fetch so each new URL is checked against the permission rules first.
const request = (url: string, init: Init, redirects: number): Effect.Effect<Fetched, Error, Guard> =>
  Effect.gen(function* () {
    const response = yield* hop(url, init)
    const location = response.headers.get("location")
    if (!redirectStatuses.has(response.status) || !location) return { response, url, redirected: redirects > 0 }
    if (redirects >= MAX_REDIRECTS)
      return yield* Effect.fail(new Error(`Too many redirects (more than ${MAX_REDIRECTS})`))
    const target = yield* Effect.try({
      try: () => {
        const next = new URL(location, url)
        assertTargetAllowed(next)
        return next
      },
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    })
    yield* (yield* Guard).check(target.href)
    // 301/302/303 downgrade to GET without a body; 307/308 preserve method and body.
    const method = (init.method ?? "GET").toUpperCase()
    const downgrade = response.status !== 307 && response.status !== 308 && method !== "GET" && method !== "HEAD"
    const crossOrigin = target.origin !== new URL(url).origin
    if (crossOrigin && !downgrade && init.body != null)
      return yield* Effect.fail(
        new Error(`Refusing to replay a request body across origins (${response.status} redirect)`),
      )
    // Cross-origin hops drop credential headers (case-insensitive), credentials mode and referrer.
    const nextInit: Init = downgrade
      ? { headers: crossOrigin ? stripSensitive(headerEntries(init.headers)) : init.headers }
      : crossOrigin
        ? { method: init.method, headers: stripSensitive(headerEntries(init.headers)), body: init.body }
        : init
    return yield* request(target.href, nextInit, redirects + 1)
  })

// Model code may pass a Request object; merge it with init (init wins). A Request carrying a body
// cannot be replayed safely, so it is refused - pass the body via init instead.
const normalize = (input: string | URL | globalThis.Request, init: Init): { url: string; init: Init } => {
  if (input instanceof globalThis.Request) {
    if (input.body != null) throw new Error("fetch with a Request that has a body is not supported; pass body via init")
    return {
      url: input.url,
      init: {
        method: init.method ?? input.method,
        headers: [...headerEntries(input.headers), ...headerEntries(init.headers)],
        body: init.body,
        credentials: init.credentials ?? input.credentials,
        referrer: init.referrer ?? (input.referrer && input.referrer !== "about:client" ? input.referrer : undefined),
      },
    }
  }
  return { url: String(input), init }
}

const fetch = Extension.async((input: string | URL, init: Init = {}) =>
  Effect.gen(function* () {
    const parsed = yield* Effect.try({
      try: () => {
        if (URL.parse(String(input instanceof globalThis.Request ? input.url : input))?.protocol === "file:")
          throw new Error("fetch cannot be used for filesystem access.")
        const { url, init: merged } = normalize(input, init)
        const target = new URL(url)
        assertTargetAllowed(target)
        return { url: target.href, init: merged }
      },
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    })
    const guard = yield* Guard
    const method = typeof parsed.init.method === "string" ? parsed.init.method.toUpperCase() : "GET"
    yield* guard.approve(parsed.url, method)
    const { response, url, redirected } = yield* request(parsed.url, parsed.init, 0)
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
