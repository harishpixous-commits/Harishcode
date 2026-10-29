// External published package identity is not application branding; retain its original scope.
import { binaryPath } from "@opencode-ai/pty"

const binding: string | { readonly path: string; readonly version: string; readonly sha256: string } | undefined =
  binaryPath

export default binding
