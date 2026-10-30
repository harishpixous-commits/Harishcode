/** OpenHands protocol preparation. Not registered as a tool or a runnable agent backend. */
export type OpenHandsServerInfo = {
  version: string
  sdkVersion: string
  conversationRuntime: "local" | "docker"
  capabilities: string[]
}

export class OpenHandsInspectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OpenHandsInspectionError"
  }
}

/** Only an explicitly selected origin is allowed. Never derive it from model or tool output. */
export function serverOrigin(value: string) {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new OpenHandsInspectionError("Invalid OpenHands server origin")
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    throw new OpenHandsInspectionError("Remote OpenHands inspection requires HTTPS")
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== ""))
    throw new OpenHandsInspectionError("Use an origin without credentials, path, query or fragment")
  return url.origin
}

/**
 * Explicit read-only metadata probe. Does not install, start or create a conversation,
 * send workspace contents, run a model, approve tools, or infer sandbox guarantees.
 * Caller owns origin authorization. Metadata is public; never send credentials here.
 */
export async function inspectOpenHands(input: {
  origin: string
  signal?: AbortSignal
  fetch?: typeof fetch
}): Promise<OpenHandsServerInfo> {
  const origin = serverOrigin(input.origin)
  const signal = input.signal ? AbortSignal.any([input.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000)
  let response: Response
  try {
    response = await (input.fetch ?? fetch)(`${origin}/server_info`, {
      method: "GET",
      redirect: "error",
      credentials: "omit",
      signal,
    })
  } catch {
    throw new OpenHandsInspectionError("OpenHands inspection failed or timed out")
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new OpenHandsInspectionError(`OpenHands inspection returned HTTP ${response.status}`)
  }
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    await response.body?.cancel()
    throw new OpenHandsInspectionError("OpenHands metadata response is not JSON")
  }
  const reader = response.body?.getReader()
  if (!reader) throw new OpenHandsInspectionError("OpenHands metadata response is empty")
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 65536) throw new OpenHandsInspectionError("OpenHands metadata response exceeds limit")
      chunks.push(chunk.value)
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    if (error instanceof OpenHandsInspectionError) throw error
    throw new OpenHandsInspectionError("OpenHands metadata response could not be read")
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  let data: unknown
  try {
    data = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new OpenHandsInspectionError("OpenHands metadata response is invalid JSON")
  }
  if (!data || typeof data !== "object") throw new OpenHandsInspectionError("Invalid OpenHands server metadata")
  const value = data as Record<string, unknown>
  if (
    typeof value.version !== "string" ||
    value.version.length > 100 ||
    typeof value.sdk_version !== "string" ||
    value.sdk_version.length > 100 ||
    (value.conversation_runtime !== "local" && value.conversation_runtime !== "docker") ||
    !Array.isArray(value.capabilities) ||
    value.capabilities.length > 256 ||
    !value.capabilities.every((item) => typeof item === "string" && item.length <= 200)
  )
    throw new OpenHandsInspectionError("Unsupported OpenHands server metadata contract")
  return {
    version: value.version,
    sdkVersion: value.sdk_version,
    conversationRuntime: value.conversation_runtime as "local" | "docker",
    capabilities: [...value.capabilities],
  }
}
