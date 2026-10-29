export const available = true

export async function resolveBinary() {
  return process.env.HARISHCODE_PTY_BIN || "harishcode-pty"
}
