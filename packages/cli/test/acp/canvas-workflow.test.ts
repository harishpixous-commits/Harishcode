import { expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { resolveReviewProfile } from "../../src/acp/guarded"
import { delivered, ephemeralEvent, permissionAsked, startWire, succeeded, turn } from "./wire-fixture"

// Composed Canvas-launch workflow over the pinned ACP wire (SDK 1.6.0, protocolVersion 1) with a
// fake model and disposable workspace only: handshake, guarded session creation, a permission
// settled by an external reviewer (never the auto-approving client), cancellation, and reuse.
test("guarded Canvas workflow: handshake, external approval, cancellation, and session reuse", async () => {
  const workspace = mkdtempSync(join(tmpdir(), "hc-canvas-workflow-"))
  try {
    const profile = resolveReviewProfile({ permissionReview: "harishcode", reviewWorkspace: workspace })
    if (profile.mode !== "harishcode") throw new Error("expected guarded profile")
    let prompts = 0
    const acp = await startWire({
      permissionReview: profile.mode,
      reviewWorkspace: profile.workspace,
      permissionReviewTimeout: profile.timeout,
      onPrompt: ({ sessionID, id }) => {
        prompts += 1
        if (prompts === 1) return [delivered(sessionID, id), permissionAsked(sessionID, "perm_workflow")]
        if (prompts === 2) return [delivered(sessionID, id)]
        return turn(sessionID, id)
      },
      permission: () => {
        throw new Error("auto-approving client must never be consulted")
      },
    })
    try {
      const handshake = await acp.initialize()
      expect(handshake.protocolVersion).toBe(1)
      expect(handshake.agentInfo).toMatchObject({ name: "HarishCode" })

      const session = await acp.newSession(profile.workspace)
      expect(acp.server.sessions.get(session.sessionId)?.metadata).toMatchObject({
        "harishcode.openhands.requireReview": true,
      })

      const first = acp.prompt(session.sessionId, "first")
      await acp.until(() => acp.server.submissions.length === 1, "first prompt submitted")
      await new Promise((resolve) => setTimeout(resolve, 20))
      expect(acp.permissions).toHaveLength(0)
      acp.server.send(
        ephemeralEvent("permission.replied", {
          sessionID: session.sessionId,
          requestID: "perm_workflow",
          reply: "once",
        }),
        succeeded(session.sessionId),
      )
      expect(await first).toMatchObject({ stopReason: "end_turn" })
      expect(acp.permissions).toHaveLength(0)

      const controller = new AbortController()
      const second = acp.prompt(session.sessionId, "second", controller.signal)
      await acp.until(() => acp.server.submissions.length === 2, "second prompt submitted")
      controller.abort()
      expect(await second).toMatchObject({ stopReason: "cancelled" })
      expect(acp.server.interrupts).toEqual([session.sessionId])

      expect(await acp.prompt(session.sessionId, "third")).toMatchObject({ stopReason: "end_turn" })
      expect(prompts).toBe(3)
    } finally {
      await acp[Symbol.asyncDispose]()
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
