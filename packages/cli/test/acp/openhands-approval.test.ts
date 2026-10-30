/** Trusted-client contract test only. Does not run Canvas or its autoapproving SDK client. */
import { expect, test } from "bun:test"
import { OpenHandsApprovalGate } from "../../../core/src/integrations/openhands/approval"
import {
  delivered,
  ephemeralEvent,
  interrupted,
  permissionAsked,
  makeSession,
  rpcError,
  startWire,
  startSession,
  succeeded,
  turn,
} from "./wire-fixture"

test("ACP permission waits for separately scoped review and forwards only one-time decision", async () => {
  const gate = new OpenHandsApprovalGate()
  let review!: ReturnType<OpenHandsApprovalGate["request"]>
  let shown!: () => void
  const ready = new Promise<void>((resolve) => {
    shown = resolve
  })
  await using acp = await startSession({
    onPrompt: ({ sessionID, id }) => turn(sessionID, id, permissionAsked(sessionID, "perm_guarded")),
    permission: async (request, signal) => {
      review = gate.request({
        sessionID: request.sessionId,
        toolCallID: request.toolCall.toolCallId,
        description: request.toolCall.title ?? "Review tool",
        signal,
      })
      shown()
      const decision = await review.outcome
      return { outcome: { outcome: "selected", optionId: decision } }
    },
  })
  const prompt = acp.prompt(acp.sessionId, "fixture only")
  await ready
  expect(acp.server.replies).toHaveLength(0)
  expect(gate.decide("wrong-session", review.request.id, "once")).toBe(false)
  expect(gate.decide(acp.sessionId, review.request.id, "always")).toBe(false)
  expect(acp.server.replies).toHaveLength(0)
  expect(gate.decide(acp.sessionId, review.request.id, "once")).toBe(true)
  expect(await prompt).toMatchObject({ stopReason: "end_turn" })
  expect(acp.server.replies.map((reply) => [reply.requestID, reply.decision])).toEqual([["perm_guarded", "once"]])
  expect(gate.decide(acp.sessionId, review.request.id, "once")).toBe(false)
  gate.close()
})

test("lost approval connection rejects pending ACP permission instead of following an automatic reply", async () => {
  const gate = new OpenHandsApprovalGate()
  let shown!: () => void
  const ready = new Promise<void>((resolve) => {
    shown = resolve
  })
  await using acp = await startSession({
    onPrompt: ({ sessionID, id }) => turn(sessionID, id, permissionAsked(sessionID, "perm_closed")),
    permission: async (request, signal) => {
      const review = gate.request({
        sessionID: request.sessionId,
        toolCallID: request.toolCall.toolCallId,
        description: "fixture",
        signal,
      })
      shown()
      return { outcome: { outcome: "selected", optionId: await review.outcome } }
    },
  })
  const prompt = acp.prompt(acp.sessionId, "fixture only")
  await ready
  expect(acp.server.replies).toHaveLength(0)
  gate.close()
  await prompt
  expect(acp.server.replies.map((reply) => [reply.requestID, reply.decision])).toEqual([["perm_closed", "reject"]])
})

test("HC-owned review never invokes even an autoallowing ACP client; only server settlement completes it", async () => {
  await using acp = await startSession({
    permissionReview: "harishcode",
    reviewWorkspace: "/workspace",
    onPrompt: ({ sessionID, id }) => [
      // Keep the turn open until independent UI-equivalent server settlement.
      delivered(sessionID, id),
      permissionAsked(sessionID, "perm_ui"),
    ],
    permission: () => {
      throw new Error("autoallow client must never be consulted")
    },
  })
  const prompt = acp.prompt(acp.sessionId, "fixture only")
  await acp.until(() => acp.server.submissions.length === 1, "prompt submitted")
  await new Promise((resolve) => setTimeout(resolve, 20))
  expect(acp.permissions).toHaveLength(0)
  expect(acp.server.replies).toHaveLength(0)
  acp.server.send(
    ephemeralEvent("permission.replied", { sessionID: acp.sessionId, requestID: "perm_ui", reply: "once" }),
    succeeded(acp.sessionId),
  )
  expect(await prompt).toMatchObject({ stopReason: "end_turn" })
  expect(acp.permissions).toHaveLength(0)
  expect(acp.server.replies).toHaveLength(0)
})

test("HC-owned review cancellation rejects pending asks without consulting the ACP client", async () => {
  await using acp = await startSession({
    permissionReview: "harishcode",
    reviewWorkspace: "/workspace",
    onPrompt: ({ sessionID, id }) => [delivered(sessionID, id), permissionAsked(sessionID, "perm_cancel_ui")],
    onInterrupt: ({ sessionID }) => [interrupted(sessionID)],
    permission: () => {
      throw new Error("autoallow client must never be consulted")
    },
  })
  const prompt = acp.prompt(acp.sessionId, "fixture only")
  await acp.until(() => acp.server.submissions.length === 1, "prompt submitted")
  await new Promise((resolve) => setTimeout(resolve, 20))
  await acp.notify("session/cancel", { sessionId: acp.sessionId })
  expect(await prompt).toMatchObject({ stopReason: "cancelled" })
  await acp.until(() => acp.server.replies.length === 1, "permission rejected")
  expect(acp.server.replies.map((reply) => [reply.requestID, reply.decision])).toEqual([["perm_cancel_ui", "reject"]])
  expect(acp.permissions).toHaveLength(0)
})

test("unattended HC-owned review expires with reject, never falls back to ACP autoallow", async () => {
  await using acp = await startSession({
    permissionReview: "harishcode",
    reviewWorkspace: "/workspace",
    permissionReviewTimeout: "1 millis",
    onPrompt: ({ sessionID, id }) => turn(sessionID, id, permissionAsked(sessionID, "perm_absent_ui")),
    permission: () => ({ outcome: { outcome: "selected", optionId: "once" } }),
  })
  expect(await acp.prompt(acp.sessionId, "fixture only")).toMatchObject({ stopReason: "end_turn" })
  expect(acp.server.replies.map((reply) => [reply.requestID, reply.decision])).toEqual([["perm_absent_ui", "reject"]])
  expect(acp.permissions).toHaveLength(0)
})

test("guarded connection binds creation/load/resume/fork to owner workspace and marks new sessions before prompt", async () => {
  await using acp = await startWire({ permissionReview: "harishcode", reviewWorkspace: "/workspace" })
  await acp.initialize()
  const created = await acp.newSession("/workspace")
  expect(acp.server.sessions.get(created.sessionId)?.metadata).toMatchObject({
    "harishcode.openhands.requireReview": true,
  })
  expect(await rpcError(acp.newSession("/elsewhere"))).toMatchObject({ code: -32602 })
  expect(
    await rpcError(
      acp.request("session/new", { cwd: "/workspace", additionalDirectories: ["/elsewhere"], mcpServers: [] }),
    ),
  ).toMatchObject({ code: -32602 })
  expect(
    await rpcError(
      acp.request("session/new", {
        cwd: "/workspace",
        mcpServers: [{ name: "remote", type: "http", url: "https://fixture.invalid", headers: [] }],
      }),
    ),
  ).toMatchObject({ code: -32602 })
  acp.server.sessions.set("ses_unreviewed", makeSession("ses_unreviewed", { cwd: "/workspace" }))
  for (const method of ["session/load", "session/resume", "session/fork"] as const)
    expect(
      await rpcError(acp.request(method, { sessionId: "ses_unreviewed", cwd: "/workspace", mcpServers: [] })),
    ).toMatchObject({ code: -32602 })
  const session = acp.server.sessions.get(created.sessionId)!
  acp.server.sessions.set(created.sessionId, { ...session, metadata: {} })
  expect(await rpcError(acp.prompt(created.sessionId, "fixture only"))).toMatchObject({ code: -32602 })
  expect(acp.server.submissions).toHaveLength(0)
})

test("guarded connection without owner-supplied workspace refuses session creation", async () => {
  await using acp = await startWire({ permissionReview: "harishcode" })
  await acp.initialize()
  expect(await rpcError(acp.newSession("/workspace"))).toMatchObject({ code: -32602 })
  expect(acp.server.sessions.size).toBe(0)
})
