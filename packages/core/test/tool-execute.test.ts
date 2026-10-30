import { expect, test } from "bun:test"
import { CodeModeTool } from "@harishcode/core/codemode/tool"
import type { CodeModeWeb } from "@harishcode/core/codemode/web"
import { AppNodeBuilder } from "@harishcode/core/effect/app-node-builder"
import { Image } from "@harishcode/core/image"
import { Permission } from "@harishcode/core/permission"
import { Wildcard } from "@harishcode/core/util/wildcard"
import type { Context as ToolContext } from "@harishcode/schema/tool"
import { imagePassthrough } from "./lib/image"
import { permissionLayer } from "./lib/permission"
import { executeTool as registryExecute, toolIdentity } from "./lib/tool"
import { Tool } from "@harishcode/core/tool"
import { execute } from "@harishcode/core/tool/runtime"
import { Agent } from "@harishcode/schema/agent"
import { Session } from "@harishcode/schema/session"
import { SessionMessage } from "@harishcode/schema/session-message"
import type { Info } from "@harishcode/schema/tool"
import { Deferred, Fiber, Effect, Schema } from "effect"
import { TestClock } from "effect/testing"
import { it } from "./lib/effect"

const context = {
  sessionID: Session.ID.make("ses_execute"),
  agent: Agent.ID.make("build"),
  messageID: SessionMessage.ID.make("msg_execute"),
  id: Tool.CallID.make("call_execute"),
  progress: () => Effect.void,
}

const createCodeMode = (tools: ReadonlyMap<string, Info>) =>
  CodeModeTool.create({ tools }, (_, tool, input, context) => execute(tool, input, context))

test("execute describes invariant Code Mode behavior", () => {
  expect(createCodeMode(new Map()).description).toBe(
    [
      "Run JavaScript in a confined Code Mode runtime to script tool calls and HTTP requests and compose their results.",
      "`fetch` is available for HTTP requests. Imports, direct filesystem access, and timers are unavailable: there is no `setTimeout` or sleep. All other external access goes through `tools`.",
      "Within `{ code }`, the only callable tools are those explicitly listed in the Code Mode catalog instructions or returned by the `search` function. Inside `{ code }`, ignore tools shown outside the Code Mode catalog. They are not available in the Code Mode runtime.",
      'Call tools through `tools` using only exact paths and signatures from the catalog. Do not infer or normalize tool names; preserve bracket notation such as `tools.<namespace>["tool-name"](input)`.',
      "Prefer an explicit `return`; if omitted, the final top-level expression becomes the result.",
      "Await every call whose completion matters; pending calls are interrupted when execution ends. Run independent calls concurrently with `Promise.allSettled`.",
    ].join("\n"),
  )
})

test("execute rejects filesystem fetches", async () => {
  const result = await Effect.runPromise(
    createCodeMode(new Map()).execute({ code: 'return await fetch("file:///blocked.txt")' }, context),
  )

  expect(result.output.error).toBe(true)
  expect(result.output.output).toContain("fetch cannot be used for filesystem access.")
})

test("canonical execution distinguishes declared, model-only, and raw schema outputs", async () => {
  const declared: Info = {
    name: "declared",
    description: "Declared",
    input: Schema.Struct({ value: Schema.String }),
    output: Schema.Struct({ value: Schema.String }),
    execute: ({ value }) => Effect.succeed({ output: { value } }),
  }
  const modelOnlyInput = Schema.Struct({})
  const modelOnly = {
    name: "model_only",
    description: "Model only",
    input: modelOnlyInput,
    execute: () => Effect.succeed({ content: "visible only", metadata: { kind: "model" } }),
  } satisfies Info<typeof modelOnlyInput, undefined>
  const raw: Info = {
    name: "raw",
    description: "Raw",
    input: {},
    output: {},
    execute: (input) => Effect.succeed({ output: input, content: "raw" }),
  }

  expect(await Effect.runPromise(execute(declared, { value: "encoded" }, context))).toEqual({
    output: { value: "encoded" },
    content: [{ type: "text", text: '{"value":"encoded"}' }],
  })
  expect(await Effect.runPromise(execute(modelOnly, {}, context))).toEqual({
    output: undefined,
    content: [{ type: "text", text: "visible only" }],
    metadata: { kind: "model" },
  })
  expect(await Effect.runPromise(execute(raw, { unchecked: true }, context))).toEqual({
    output: { unchecked: true },
    content: [{ type: "text", text: "raw" }],
  })
})

test("declared outputs cannot bypass validation and raw outputs stay JSON-compatible", async () => {
  const missing: Info = {
    name: "missing",
    description: "Missing output",
    input: Schema.Struct({}),
    output: Schema.String,
    execute: () => Effect.succeed({ content: "not an output" }),
  }
  const invalid: Info = {
    name: "invalid",
    description: "Invalid raw output",
    input: {},
    output: {},
    execute: () => Effect.succeed({ output: 1n, content: "not JSON" }),
  }

  expect((await Effect.runPromiseExit(execute(missing, {}, context))).toString()).toContain(
    "Tool did not return its declared output",
  )
  expect((await Effect.runPromiseExit(execute(invalid, {}, context))).toString()).toContain(
    "Tool returned a non-JSON value",
  )
})

test("foreign typed failures settle as Tool.Error at the untrusted boundary", async () => {
  class ForeignFailure extends Schema.TaggedError<ForeignFailure>()("Plugin.ForeignFailure", {
    message: Schema.String,
  }) {}
  const lying: Info = {
    name: "lying",
    description: "Fails with a non-Tool.Error typed failure",
    input: Schema.Struct({}),
    execute: () => new ForeignFailure({ message: "transport died" }) as never,
  }

  const error = await Effect.runPromise(execute(lying, {}, context).pipe(Effect.flip))
  expect(error).toBeInstanceOf(Tool.Error)
  expect(error.message).toBe("transport died")
})

test("execute supports callable namespace tools", async () => {
  const callable: Info = {
    name: "admin",
    description: "Administer Slack",
    input: Schema.Struct({}),
    output: Schema.String,
    options: { namespace: "slack" },
    execute: () => Effect.succeed({ output: "admin" }),
  }
  const child: Info = {
    name: "create",
    description: "Create a Slack resource",
    input: Schema.Struct({}),
    output: Schema.String,
    options: { namespace: "slack.admin" },
    execute: () => Effect.succeed({ output: "created" }),
  }
  const codeMode = createCodeMode(
    new Map([
      ["slack_admin", callable],
      ["slack_admin_create", child],
    ]),
  )
  const result = await Effect.runPromise(
    codeMode.execute({ code: "return [await tools.slack.admin({}), await tools.slack.admin.create({})]" }, context),
  )

  expect(result.metadata).toEqual({
    toolCalls: [
      { tool: "slack.admin", status: "completed" },
      { tool: "slack.admin.create", status: "completed" },
    ],
  })
  expect(result.content).toEqual([{ type: "text", text: '[\n  "admin",\n  "created"\n]' }])
})

test("executions share the prepared runtime of an inventory while keeping per-call state", async () => {
  let conversions = 0
  const echo: Info = {
    name: "echo",
    description: "Echo a value",
    input: {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: (value: unknown) => ({ value }),
        jsonSchema: {
          input: () => {
            conversions++
            return { type: "object", properties: { value: { type: "string" } }, required: ["value"] }
          },
          output: () => ({}),
        },
      },
    },
    execute: (input, context) => Effect.succeed({ content: `${context.id}:${(input as { value: string }).value}` }),
  }
  const inventory = { tools: new Map([["echo", echo]]) }
  const codeMode = CodeModeTool.create(inventory, (_, tool, input, context) => execute(tool, input, context))
  const run = (id: string) => {
    const progress: Array<Tool.Metadata> = []
    return CodeModeTool.create(inventory, (_, tool, input, context) => execute(tool, input, context))
      .execute(
        { code: `return await tools.echo({ value: "${id}" })` },
        { ...context, id: Tool.CallID.make(id), progress: (update) => Effect.sync(() => progress.push(update)) },
      )
      .pipe(Effect.map((result) => ({ output: result.output.output, progress })))
  }

  expect(CodeModeTool.catalog(inventory).tools).toHaveLength(1)
  const results = await Effect.runPromise(
    Effect.all([run("first"), run("second")], { concurrency: "unbounded" }).pipe(Effect.provide(TestClock.layer())),
  )
  expect<unknown>(results).toEqual(
    ["first", "second"].map((id) => ({
      output: `${id}:${id}`,
      progress: [{ toolCalls: [{ tool: "echo", status: "running", input: { value: id } }] }],
    })),
  )
  expect(
    (await Effect.runPromise(codeMode.execute({ code: 'return await tools.echo({ value: "x" })' }, context))).output
      .output,
  ).toBe("call_execute:x")
  expect(conversions).toBe(1)

  await Effect.runPromise(
    createCodeMode(new Map(inventory.tools)).execute({ code: 'return await tools.echo({ value: "next" })' }, context),
  )
  expect(conversions).toBe(2)
})

const withGuard = (guard: (execution: ToolContext) => CodeModeWeb.GuardService) =>
  CodeModeTool.create({ tools: new Map() }, (_, tool, input, context) => execute(tool, input, context), guard)

type NetCall = { url: string; init?: RequestInit }

const stubNetwork = (handler: (url: string, calls: NetCall[]) => Response | Promise<Response>) => {
  const calls: NetCall[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    return handler(url, calls)
  }) as typeof fetch
  return {
    get calls() {
      return calls.map((c) => c.url)
    },
    entries: calls,
    restore: () => void (globalThis.fetch = original),
  }
}

test("CodeMode fetch requires guard approval before any network request", async () => {
  const asked: Array<{ url: string; method: string }> = []
  let guardContext: unknown
  const net = stubNetwork(() => new Response("should not reach the network"))
  try {
    const result = await Effect.runPromise(
      withGuard((execution) => {
        guardContext = execution
        return {
          approve: (url, method) => {
            asked.push({ url, method })
            return Effect.fail(new Error("Permission denied"))
          },
          check: () => Effect.void,
        }
      }).execute({ code: 'return await fetch("https://example.com/data")' }, context),
    )
    expect(result.output.error).toBe(true)
    expect(result.output.output).toContain("Permission denied")
    expect(net.calls).toEqual([])
    expect(asked).toEqual([{ url: "https://example.com/data", method: "GET" }])
    expect(guardContext).toMatchObject({ sessionID: context.sessionID, messageID: context.messageID, id: context.id })
  } finally {
    net.restore()
  }
})

test("approved CodeMode fetch follows redirects only after checking each target", async () => {
  const checked: string[] = []
  const net = stubNetwork((url, calls) =>
    calls.length === 1
      ? new Response(null, { status: 302, headers: { location: "/next" } })
      : new Response("final body", { status: 200, headers: { "content-type": "text/plain" } }),
  )
  try {
    const result = await Effect.runPromise(
      withGuard(() => ({
        approve: () => Effect.void,
        check: (url) => {
          checked.push(url)
          return Effect.void
        },
      })).execute({ code: 'const res = await fetch("https://example.com/start"); return await res.text()' }, context),
    )
    expect(result.output.error).toBeUndefined()
    expect(result.output.output).toBe("final body")
    expect(net.calls).toEqual(["https://example.com/start", "https://example.com/next"])
    expect(checked).toEqual(["https://example.com/next"])
  } finally {
    net.restore()
  }
})

test("CodeMode fetch stops before a denied redirect target", async () => {
  const net = stubNetwork(() => new Response(null, { status: 302, headers: { location: "https://denied.example/x" } }))
  try {
    const result = await Effect.runPromise(
      withGuard(() => ({
        approve: () => Effect.void,
        check: () => Effect.fail(new Error("Permission denied")),
      })).execute({ code: 'return await fetch("https://example.com/start")' }, context),
    )
    expect(result.output.error).toBe(true)
    expect(net.calls).toEqual(["https://example.com/start"])
  } finally {
    net.restore()
  }
})

test("CodeMode fetch fails closed when no permission guard is provided", async () => {
  const net = stubNetwork(() => new Response("should not reach the network"))
  try {
    const result = await Effect.runPromise(
      createCodeMode(new Map()).execute({ code: 'return await fetch("https://example.com/data")' }, context),
    )
    expect(result.output.error).toBe(true)
    expect(result.output.output).toContain("no permission guard")
    expect(net.calls).toEqual([])
  } finally {
    net.restore()
  }
})

test("registry mediates CodeMode fetch through the webfetch permission action", async () => {
  const asked: Permission.AssertInput[] = []
  const urls: string[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: unknown) => {
    urls.push(String(input))
    return new Response("should not reach the network")
  }) as typeof fetch
  try {
    const layer = AppNodeBuilder.build(Tool.node, [
      Image.node.replace(imagePassthrough),
      Permission.node.replace(
        permissionLayer({
          assert: (input) => {
            asked.push(input)
            return Effect.fail(
              new Permission.BlockedError({ rules: [], permission: input.action, resources: [...input.resources] }),
            )
          },
        }),
      ),
    ])
    const program = Effect.gen(function* () {
      const tools = yield* Tool.Service
      return yield* registryExecute(tools, {
        sessionID: context.sessionID,
        ...toolIdentity,
        call: {
          type: "tool-call",
          id: context.id,
          name: "execute",
          input: { code: 'return await fetch("https://example.com/registry")' },
        },
      })
    }).pipe(Effect.provide(layer), Effect.scoped)
    const result = await Effect.runPromise(program)
    expect(result).toMatchObject({ metadata: { error: true } })
    expect(urls).toEqual([])
    expect(asked[0]).toMatchObject({
      action: "webfetch",
      resources: ["https://example.com/registry"],
      save: ["https://example.com/*"],
      sessionID: context.sessionID,
      source: { type: "tool", messageID: toolIdentity.messageID, id: context.id },
    })
  } finally {
    globalThis.fetch = original
  }
})

test("cross-origin redirect strips credential headers case-insensitively; same-origin keeps them", async () => {
  const net = stubNetwork((url) =>
    url === "https://example.com/start"
      ? new Response(null, { status: 302, headers: { location: "https://other.example/final" } })
      : new Response("done"),
  )
  try {
    const result = await Effect.runPromise(
      withGuard(() => ({ approve: () => Effect.void, check: () => Effect.void })).execute(
        {
          code: 'return await fetch("https://example.com/start", { headers: { Authorization: "Bearer t", COOKIE: "s=1", "X-Custom": "keep" } }).then((r) => r.text())',
        },
        context,
      ),
    )
    expect(result.output.error).toBeUndefined()
    const forwarded = net.entries[1]?.init?.headers as Array<[string, string]>
    expect(forwarded).toEqual([["X-Custom", "keep"]])
  } finally {
    net.restore()
  }

  const same = stubNetwork((url) =>
    url === "https://example.com/start"
      ? new Response(null, { status: 302, headers: { location: "/next" } })
      : new Response("done"),
  )
  try {
    const result = await Effect.runPromise(
      withGuard(() => ({ approve: () => Effect.void, check: () => Effect.void })).execute(
        {
          code: 'return await fetch("https://example.com/start", { headers: { authorization: "Bearer t" } }).then((r) => r.text())',
        },
        context,
      ),
    )
    expect(result.output.error).toBeUndefined()
    expect(same.entries[1]?.init?.headers).toEqual({ authorization: "Bearer t" })
  } finally {
    same.restore()
  }
})

test("307 replay keeps method and body same-origin but refuses cross-origin body replay", async () => {
  const same = stubNetwork((url) =>
    url === "https://example.com/upload"
      ? new Response(null, { status: 307, headers: { location: "/upload2" } })
      : new Response("ok"),
  )
  try {
    const result = await Effect.runPromise(
      withGuard(() => ({ approve: () => Effect.void, check: () => Effect.void })).execute(
        {
          code: 'return await fetch("https://example.com/upload", { method: "POST", body: "payload" }).then((r) => r.text())',
        },
        context,
      ),
    )
    expect(result.output.error).toBeUndefined()
    expect(same.entries[1]?.init?.method).toBe("POST")
    expect(same.entries[1]?.init?.body).toBe("payload")
  } finally {
    same.restore()
  }

  const cross = stubNetwork(() => new Response(null, { status: 307, headers: { location: "https://evil.example/x" } }))
  try {
    const result = await Effect.runPromise(
      withGuard(() => ({ approve: () => Effect.void, check: () => Effect.void })).execute(
        { code: 'return await fetch("https://example.com/upload", { method: "POST", body: "secret" })' },
        context,
      ),
    )
    expect(result.output.error).toBe(true)
    expect(result.output.output).toContain("Refusing to replay a request body across origins")
    expect(cross.calls).toEqual(["https://example.com/upload"])
  } finally {
    cross.restore()
  }
})

test("cloud metadata endpoints are blocked before any guard approval", async () => {
  const net = stubNetwork(() => new Response("should not reach the network"))
  const asked: string[] = []
  try {
    const result = await Effect.runPromise(
      withGuard(() => ({
        approve: (url) => {
          asked.push(url)
          return Effect.void
        },
        check: () => Effect.void,
      })).execute({ code: 'return await fetch("http://169.254.169.254/latest/meta-data/")' }, context),
    )
    expect(result.output.error).toBe(true)
    expect(result.output.output).toContain("not permitted")
    expect(net.calls).toEqual([])
    expect(asked).toEqual([])
  } finally {
    net.restore()
  }
})

test("no egress while approval is pending; interruption aborts an in-flight hop", async () => {
  const net = stubNetwork(() => new Promise<Response>(() => {}))
  try {
    const pending = Effect.runFork(
      withGuard(() => ({ approve: () => Effect.never, check: () => Effect.void })).execute(
        { code: 'return await fetch("https://example.com/data")' },
        context,
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(net.calls).toEqual([])
    await Effect.runPromise(Fiber.interrupt(pending))
    expect(net.calls).toEqual([])

    const flight = Effect.runFork(
      withGuard(() => ({ approve: () => Effect.void, check: () => Effect.void })).execute(
        { code: 'return await fetch("https://example.com/slow")' },
        context,
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(net.calls).toEqual(["https://example.com/slow"])
    await Effect.runPromise(Fiber.interrupt(flight))
    const signal = net.entries[0]?.init?.signal
    expect(signal?.aborted).toBe(true)
  } finally {
    net.restore()
  }
})

test("origin-scoped save pattern matches same origin and fails closed on port, userinfo and case variants", () => {
  const pattern = "https://example.com/*"
  expect(Wildcard.match("https://example.com/", pattern)).toBe(true)
  expect(Wildcard.match("https://example.com/path?q=1", pattern)).toBe(true)
  expect(Wildcard.match("https://example.com:8443/path", pattern)).toBe(false)
  expect(Wildcard.match("https://user@example.com/path", pattern)).toBe(false)
  expect(Wildcard.match("https://example.com.evil.com/", pattern)).toBe(false)
  if (process.platform === "win32") {
    expect(Wildcard.match("HTTPS://EXAMPLE.COM/path", pattern)).toBe(true)
  } else {
    expect(Wildcard.match("HTTPS://EXAMPLE.COM/path", pattern)).toBe(false)
  }
  expect(Wildcard.match("https://example.com:443/", pattern)).toBe(false)
})

const progressCodeMode = (started: Deferred.Deferred<void>, wait: Effect.Effect<void>) =>
  createCodeMode(
    new Map<string, Info>([
      [
        "step",
        {
          name: "step",
          description: "Step",
          input: Schema.Struct({}),
          output: Schema.String,
          execute: () => Effect.succeed({ output: "ok" }),
        },
      ],
      [
        "wait",
        {
          name: "wait",
          description: "Wait",
          input: Schema.Struct({}),
          output: Schema.String,
          execute: () => Deferred.succeed(started, undefined).pipe(Effect.andThen(wait), Effect.as({ output: "ok" })),
        },
      ],
    ]),
  )

const row = (tool: string, status: string) => ({ tool, status })

it.effect("execute sends at most one progress update per 100 ms with the latest rows", () =>
  Effect.gen(function* () {
    const started = yield* Deferred.make<void>()
    const progress: Array<Tool.Metadata> = []
    const fiber = yield* progressCodeMode(started, Effect.sleep("250 millis"))
      .execute(
        { code: "for (const i of [1, 2, 3]) await tools.step({}); await tools.wait({}); return await tools.step({})" },
        { ...context, progress: (update) => Effect.sync(() => progress.push(update)) },
      )
      .pipe(Effect.forkChild({ startImmediately: true }))
    yield* Deferred.await(started)
    yield* Effect.yieldNow
    expect(progress).toEqual([{ toolCalls: [row("step", "running")] }])

    yield* TestClock.adjust("100 millis")
    const steps = [row("step", "completed"), row("step", "completed"), row("step", "completed")]
    expect(progress.slice(1)).toEqual([{ toolCalls: [...steps, row("wait", "running")] }])

    // The wait ends 150 ms after the trailing update, so its row goes out at once; the last step's never does.
    yield* TestClock.adjust("150 millis")
    const result = yield* Fiber.join(fiber)
    yield* TestClock.adjust("1 second")
    expect(progress.slice(2)).toEqual([{ toolCalls: [...steps, row("wait", "completed")] }])
    expect(result.metadata).toEqual({ toolCalls: [...steps, row("wait", "completed"), row("step", "completed")] })
  }),
)
