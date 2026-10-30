import { expect } from "bun:test"
import { requireReviewKey } from "@harishcode/schema/session-review"
import { Effect } from "effect"
import { it } from "../../core/test/lib/effect"
import { ServerFetch } from "../src/fetch"

const AUTH = `Basic ${btoa("harishcode:secret")}`

const boot = Effect.gen(function* () {
  const handler = yield* ServerFetch.make({
    password: "secret",
    app: { version: "test" },
    database: { path: ":memory:" },
    fs: { filewatcher: false },
    models: { fetch: false },
  })
  const request = async (path: string, method: string, body?: unknown, auth = true) => {
    const response = await handler(
      new Request(`http://harishcode.local${path}`, {
        method,
        headers: { "content-type": "application/json", ...(auth ? { authorization: AUTH } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
    return { status: response.status, body: response.status === 204 ? undefined : await response.json() }
  }
  const createSession = async (guarded: boolean) => {
    const created = await request("/api/session", "POST", {
      permissions: [{ action: "deploy", resource: "*", effect: "ask" }],
      ...(guarded ? { metadata: { [requireReviewKey]: true } } : {}),
    })
    expect(created.status).toBe(200)
    return created.body.data.id as string
  }
  const ask = async (sessionID: string, resource: string) => {
    const created = await request(`/api/session/${sessionID}/permission`, "POST", {
      action: "deploy",
      resources: [resource],
    })
    expect(created.status).toBe(200)
    return created.body.data.id as string
  }
  const getRequest = (sessionID: string, requestID: string) =>
    request(`/api/session/${sessionID}/permission/${requestID}`, "GET")
  const reply = (sessionID: string, requestID: string, body: unknown, auth = true) =>
    request(`/api/session/${sessionID}/permission/${requestID}/reply`, "POST", body, auth)
  const until = async (check: () => Promise<boolean>, ms = 4_000) => {
    const deadline = Date.now() + ms
    while (Date.now() < deadline) {
      if (await check()) return true
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return false
  }
  const subscribe = async (review: boolean) => {
    const response = await handler(
      new Request(`http://harishcode.local/api/event${review ? "?review=true" : ""}`, {
        headers: { authorization: AUTH },
      }),
    )
    expect(response.status).toBe(200)
    const reader = response.body!.getReader()
    const buffer = { text: "" }
    const frame = async (ms = 4_000): Promise<any> => {
      const deadline = Date.now() + ms
      for (;;) {
        const boundary = buffer.text.indexOf("\n\n")
        if (boundary >= 0) {
          const chunk = buffer.text.slice(0, boundary)
          buffer.text = buffer.text.slice(boundary + 2)
          const line = chunk.split("\n").find((entry) => entry.startsWith("data: "))
          if (line) return JSON.parse(line.slice(6))
          if (Date.now() >= deadline) throw new Error("frame deadline")
          continue
        }
        if (Date.now() >= deadline) throw new Error("frame deadline")
        const { done, value } = await reader.read()
        if (done) throw new Error("stream ended")
        buffer.text += new TextDecoder().decode(value, { stream: true })
      }
    }
    return { reader, frame, close: () => reader.cancel() }
  }
  return { request, createSession, ask, getRequest, reply, until, subscribe }
})

it.live("guarded asks are rejected at creation while no reviewer is connected", () =>
  Effect.gen(function* () {
    const server = yield* boot
    const sessionID = yield* Effect.promise(() => server.createSession(true))
    const requestID = yield* Effect.promise(() => server.ask(sessionID, "src/*"))
    // The ask was created, then the no-reviewer guard settles it without any reply call.
    expect(
      yield* Effect.promise(() =>
        server.until(async () => (await server.getRequest(sessionID, requestID)).status === 404),
      ),
    ).toBe(true)
  }).pipe(Effect.scoped),
)

it.live("guarded approvals require a live reviewer token, rejects never do", () =>
  Effect.gen(function* () {
    const server = yield* boot
    const reviewer = yield* Effect.promise(() => server.subscribe(true))
    const connected = yield* Effect.promise(() => reviewer.frame())
    expect(connected.type).toBe("server.connected")
    const token = connected.data.reviewer as string
    expect(typeof token).toBe("string")

    const sessionID = yield* Effect.promise(() => server.createSession(true))

    // With a reviewer connected the ask pends instead of being auto-rejected.
    const first = yield* Effect.promise(() => server.ask(sessionID, "src/a.ts"))
    yield* Effect.sleep("300 millis")
    expect((yield* Effect.promise(() => server.getRequest(sessionID, first))).status).toBe(200)

    // Missing and forged tokens cannot approve.
    expect((yield* Effect.promise(() => server.reply(sessionID, first, { decision: "once" }))).status).toBe(403)
    expect(
      (yield* Effect.promise(() => server.reply(sessionID, first, { decision: "always", reviewer: "forged" }))).status,
    ).toBe(403)
    expect((yield* Effect.promise(() => server.getRequest(sessionID, first))).status).toBe(200)

    // Rejects need no token, so a lost token can never wedge a decline.
    expect((yield* Effect.promise(() => server.reply(sessionID, first, { decision: "reject" }))).status).toBe(204)

    // A live token approves, and the settle event is stamped with the reviewer identity.
    const second = yield* Effect.promise(() => server.ask(sessionID, "src/b.ts"))
    expect(
      (yield* Effect.promise(() => server.reply(sessionID, second, { decision: "once", reviewer: token }))).status,
    ).toBe(204)
    const replied = yield* Effect.promise(async () => {
      for (;;) {
        const event = await reviewer.frame()
        if (event.type === "permission.replied" && event.data.requestID === second) return event
      }
    })
    expect(replied.data.reply).toBe("once")
    expect(replied.data.repliedBy).toMatch(/^reviewer:/)

    // Unguarded sessions keep the existing behavior: no token required.
    const plain = yield* Effect.promise(() => server.createSession(false))
    const third = yield* Effect.promise(() => server.ask(plain, "src/c.ts"))
    expect((yield* Effect.promise(() => server.reply(plain, third, { decision: "once" }))).status).toBe(204)

    // Unauthenticated calls never reach the gate at all.
    const fourth = yield* Effect.promise(() => server.ask(sessionID, "src/d.ts"))
    expect((yield* Effect.promise(() => server.reply(sessionID, fourth, { decision: "once" }, false))).status).toBe(401)

    yield* Effect.promise(() => reviewer.close())
  }).pipe(Effect.scoped),
)

it.live("losing a reviewer revokes its token; losing the last rejects pending guarded asks", () =>
  Effect.gen(function* () {
    const server = yield* boot
    const first = yield* Effect.promise(() => server.subscribe(true))
    const firstConnected = yield* Effect.promise(() => first.frame())
    const firstToken = firstConnected.data.reviewer as string
    const second = yield* Effect.promise(() => server.subscribe(true))
    const secondConnected = yield* Effect.promise(() => second.frame())
    const secondToken = secondConnected.data.reviewer as string

    const sessionID = yield* Effect.promise(() => server.createSession(true))
    const pending = yield* Effect.promise(() => server.ask(sessionID, "src/a.ts"))

    // One reviewer leaving keeps the session alive but revokes only its own token.
    yield* Effect.promise(() => first.close())
    expect(
      yield* Effect.promise(() =>
        server.until(async () => (await server.getRequest(sessionID, pending)).status === 200, 1_000),
      ),
    ).toBe(true)
    expect(
      (yield* Effect.promise(() => server.reply(sessionID, pending, { decision: "once", reviewer: firstToken })))
        .status,
    ).toBe(403)
    expect(
      (yield* Effect.promise(() => server.reply(sessionID, pending, { decision: "once", reviewer: secondToken })))
        .status,
    ).toBe(204)

    // The last reviewer leaving rejects every pending guarded ask with no reply call.
    const stuck = yield* Effect.promise(() => server.ask(sessionID, "src/b.ts"))
    yield* Effect.promise(() => second.close())
    expect(
      yield* Effect.promise(() => server.until(async () => (await server.getRequest(sessionID, stuck)).status === 404)),
    ).toBe(true)
    // Fail closed after that: the revoked token is useless, and without any reviewer new asks
    // are rejected at creation rather than left waiting.
    expect(
      (yield* Effect.promise(() => server.reply(sessionID, stuck, { decision: "once", reviewer: secondToken }))).status,
    ).toBe(404)
  }).pipe(Effect.scoped),
)
