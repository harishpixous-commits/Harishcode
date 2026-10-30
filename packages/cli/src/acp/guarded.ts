import { existsSync, statSync } from "node:fs"
import { Duration } from "effect"

export type ReviewProfile =
  | { readonly mode: "client" }
  | { readonly mode: "harishcode"; readonly workspace: string; readonly timeout: Duration.Input }

const MIN_TIMEOUT_MS = 1
const MAX_TIMEOUT_MS = 300_000

/**
 * Owner-controlled guarded ACP review profile for clients that cannot present meaningful user
 * approval (for example Canvas, whose SDK bridge auto-selects the first permission option).
 * Disabled by default: without explicit flags the ACP server keeps asking the connected client.
 * Review flags never come from ACP request metadata; they are process-launch configuration.
 */
export const resolveReviewProfile = (input: {
  readonly permissionReview: string
  readonly reviewWorkspace?: string | undefined
  readonly reviewTimeout?: string | undefined
}): ReviewProfile => {
  if (input.permissionReview !== "client" && input.permissionReview !== "harishcode")
    throw new Error(`Invalid --permission-review "${input.permissionReview}": expected "client" or "harishcode"`)
  if (input.permissionReview === "client") {
    if (input.reviewWorkspace !== undefined || input.reviewTimeout !== undefined)
      throw new Error("--review-workspace and --review-timeout require --permission-review harishcode")
    return { mode: "client" }
  }
  if (!input.reviewWorkspace) throw new Error("--permission-review harishcode requires --review-workspace")
  if (!input.reviewWorkspace.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(input.reviewWorkspace))
    throw new Error("--review-workspace must be an absolute path")
  if (!existsSync(input.reviewWorkspace) || !statSync(input.reviewWorkspace).isDirectory())
    throw new Error(`--review-workspace is not an existing directory: ${input.reviewWorkspace}`)
  let timeout: Duration.Input = "60 seconds"
  if (input.reviewTimeout !== undefined) {
    const ms = Number(input.reviewTimeout)
    if (!Number.isSafeInteger(ms) || ms < MIN_TIMEOUT_MS || ms > MAX_TIMEOUT_MS)
      throw new Error(`--review-timeout must be whole milliseconds between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`)
    timeout = Duration.millis(ms)
  }
  return { mode: "harishcode", workspace: input.reviewWorkspace, timeout }
}
