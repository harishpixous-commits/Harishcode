import { expect, test } from "bun:test"
import { inspectOpenHands, serverOrigin } from "../../src/integrations/openhands/inspect"

const info = {
  version: "1.59.0",
  sdk_version: "1.59.0",
  conversation_runtime: "docker",
  capabilities: ["idempotent_conversation_create_v1"],
}
const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } })
const mock = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as typeof fetch

test("origin selection refuses credentials, paths and cleartext remote servers", () => {
  for (const origin of [
    "http://remote.invalid",
    "https://user:pass@host.invalid",
    "https://host.invalid/api",
    "https://host.invalid/?key=x",
    "https://host.invalid/#x",
    "file:///tmp/a",
    "not a url",
  ])
    expect(() => serverOrigin(origin)).toThrow()
  expect(serverOrigin("https://server.invalid/")).toBe("https://server.invalid")
  expect(serverOrigin("http://127.0.0.1:18000")).toBe("http://127.0.0.1:18000")
})

test("explicit inspection sends only GET server_info, no credentials and no cookies", async () => {
  const calls: string[] = []
  const value = await inspectOpenHands({
    origin: "https://server.invalid",
    fetch: mock(async (url, init) => {
      calls.push(url)
      expect(init?.method).toBe("GET")
      expect(init?.redirect).toBe("error")
      expect(init?.credentials).toBe("omit")
      expect(init?.body).toBeUndefined()
      expect(new Headers(init?.headers).get("X-Session-API-Key")).toBeNull()
      return json(info)
    }),
  })
  expect(calls).toEqual(["https://server.invalid/server_info"])
  expect(value).toEqual({
    version: "1.59.0",
    sdkVersion: "1.59.0",
    conversationRuntime: "docker",
    capabilities: info.capabilities,
  })
})

test("network and HTTP errors never echo credential or server body", async () => {
  for (const fetch of [
    mock(async () => {
      throw new Error("fixture-secret")
    }),
    mock(async () => new Response("fixture-secret", { status: 401 })),
  ]) {
    try {
      await inspectOpenHands({ origin: "https://server.invalid", fetch })
      throw new Error("unexpected success")
    } catch (error) {
      expect(String(error)).not.toContain("fixture-secret")
    }
  }
})

test("metadata rejects malformed, oversized, unknown runtime and non-JSON responses", async () => {
  for (const response of [
    json(null),
    json({ ...info, conversation_runtime: "unsafe" }),
    json({ ...info, capabilities: [1] }),
    json({ ...info, capabilities: Array(257).fill("x") }),
    json({ x: "x".repeat(66000) }),
    new Response("bad", { headers: { "content-type": "application/json" } }),
    new Response("<html>"),
  ]) {
    await expect(
      inspectOpenHands({ origin: "https://server.invalid", fetch: mock(async () => response) }),
    ).rejects.toThrow()
  }
})

test("abort reaches the transport and is reported without private details", async () => {
  const controller = new AbortController()
  const pending = inspectOpenHands({
    origin: "https://server.invalid",
    signal: controller.signal,
    fetch: mock(
      async (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("private endpoint details")), { once: true })
        }),
    ),
  })
  controller.abort()
  await expect(pending).rejects.toThrow("OpenHands inspection failed or timed out")
})

test("stream byte bound cancels an oversized response", async () => {
  let cancelled = false
  let chunks = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunks++
      controller.enqueue(new Uint8Array(33000))
    },
    cancel() {
      cancelled = true
    },
  })
  await expect(
    inspectOpenHands({
      origin: "https://server.invalid",
      fetch: mock(async () => new Response(body, { headers: { "content-type": "application/json" } })),
    }),
  ).rejects.toThrow("exceeds limit")
  expect(cancelled).toBe(true)
  expect(chunks).toBeLessThanOrEqual(3)
})
