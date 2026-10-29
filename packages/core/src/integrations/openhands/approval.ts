/** Inactive adapter primitive. Only a trusted, authenticated UI transport may call decide(). */
export type ApprovalRequest = Readonly<{
  id: string
  sessionID: string
  toolCallID: string
  description: string
}>
export type ApprovalOutcome = "once" | "reject"

type Pending = {
  request: ApprovalRequest
  settle: (outcome: ApprovalOutcome) => void
}

/**
 * Never forwards an ACP client's automatic permission reply as user approval.
 * An integration must deliver the returned request to its own trusted review UI,
 * then call decide with that UI's authenticated session identity. No persistence
 * or 'always allow' is supported. Not wired to a backend or executable yet.
 */
export class OpenHandsApprovalGate {
  private readonly pending = new Map<string, Pending>()
  private closed = false

  request(input: {
    sessionID: string
    toolCallID: string
    description: string
    signal: AbortSignal
    timeoutMs?: number
  }): { request: ApprovalRequest; outcome: Promise<ApprovalOutcome> } {
    const request = Object.freeze({
      id: crypto.randomUUID(),
      sessionID: input.sessionID,
      toolCallID: input.toolCallID,
      description: input.description,
    })
    if (this.closed || input.signal.aborted) return { request, outcome: Promise.resolve("reject") }
    const timeoutMs = input.timeoutMs ?? 60000
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000)
      throw new Error("Invalid approval timeout")
    if (!input.sessionID || !input.toolCallID || input.description.length > 65536)
      throw new Error("Invalid approval request")
    let settle!: (outcome: ApprovalOutcome) => void
    const outcome = new Promise<ApprovalOutcome>((resolve) => {
      settle = resolve
    })
    const finish = (decision: ApprovalOutcome) => {
      if (!this.pending.delete(request.id)) return
      clearTimeout(timer)
      input.signal.removeEventListener("abort", abort)
      settle(decision)
    }
    const abort = () => finish("reject")
    const timer = setTimeout(abort, timeoutMs)
    this.pending.set(request.id, { request, settle: finish })
    input.signal.addEventListener("abort", abort, { once: true })
    if (input.signal.aborted) abort()
    return { request, outcome }
  }

  /** Session identity must come from authenticated UI context, not decision payload. */
  decide(authenticatedSessionID: string, id: string, decision: unknown): boolean {
    const pending = this.pending.get(id)
    if (!pending || pending.request.sessionID !== authenticatedSessionID) return false
    if (decision !== "once" && decision !== "reject") return false
    pending.settle(decision)
    return true
  }

  cancelSession(sessionID: string) {
    for (const value of this.pending.values()) if (value.request.sessionID === sessionID) value.settle("reject")
  }

  close() {
    this.closed = true
    for (const value of this.pending.values()) value.settle("reject")
  }
}
