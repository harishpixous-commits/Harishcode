import { expect, test } from "bun:test"
import { OpenHandsApprovalGate } from "../../src/integrations/openhands/approval"
const input = (sessionID = "fixture-a") => ({
  sessionID,
  toolCallID: "tool-1",
  description: "Edit fixture file",
  signal: new AbortController().signal,
})

test("waits for a trusted scoped decision, never autoallows", async () => {
  const gate = new OpenHandsApprovalGate()
  const a = gate.request(input())
  let resolved = false
  void a.outcome.then(() => {
    resolved = true
  })
  await Promise.resolve()
  expect(resolved).toBe(false)
  expect(Object.isFrozen(a.request)).toBe(true)
  expect(gate.decide("fixture-b", a.request.id, "once")).toBe(false)
  for (const decision of ["always", "allow_once", true, { outcome: { optionId: "once" } }])
    expect(gate.decide("fixture-a", a.request.id, decision)).toBe(false)
  expect(gate.decide("fixture-a", a.request.id, "once")).toBe(true)
  expect(await a.outcome).toBe("once")
  expect(gate.decide("fixture-a", a.request.id, "once")).toBe(false)
})

test("same tool id in concurrent sessions cannot crossapprove", async () => {
  const gate = new OpenHandsApprovalGate()
  const a = gate.request(input())
  const b = gate.request(input("fixture-b"))
  expect(a.request.id).not.toBe(b.request.id)
  expect(gate.decide("fixture-a", b.request.id, "once")).toBe(false)
  gate.cancelSession("fixture-a")
  expect(await a.outcome).toBe("reject")
  expect(gate.decide("fixture-b", b.request.id, "reject")).toBe(true)
  expect(await b.outcome).toBe("reject")
})

test("abort, disconnect and future requests fail closed", async () => {
  const gate = new OpenHandsApprovalGate()
  const controller = new AbortController()
  const a = gate.request({ ...input(), signal: controller.signal })
  controller.abort()
  expect(await a.outcome).toBe("reject")
  expect(gate.decide("fixture-a", a.request.id, "once")).toBe(false)
  const b = gate.request(input())
  gate.close()
  expect(await b.outcome).toBe("reject")
  expect(await gate.request(input()).outcome).toBe("reject")
  expect(await new OpenHandsApprovalGate().request({ ...input(), signal: controller.signal }).outcome).toBe("reject")
})

test("deadline rejects and cannot later be approved", async () => {
  const gate = new OpenHandsApprovalGate()
  const a = gate.request({ ...input(), timeoutMs: 1 })
  expect(await a.outcome).toBe("reject")
  expect(gate.decide("fixture-a", a.request.id, "once")).toBe(false)
  for (const timeoutMs of [0, -1, NaN, Infinity, 300001])
    expect(() => gate.request({ ...input(), timeoutMs })).toThrow("Invalid approval timeout")
})
