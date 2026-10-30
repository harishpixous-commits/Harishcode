import path from "node:path"

// A malformed percent escape is an invalid request, not an unhandled protocol exception.
// Keep the decoded path beneath the renderer root on both Windows and POSIX.
export function resolveRendererPath(root: string, pathname: string): string | undefined {
  let decoded: string

  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return undefined
  }

  if (!decoded.startsWith("/") || decoded.includes("\\") || decoded.includes("\0")) return undefined
  const file = path.resolve(root, `.${decoded}`)
  const rel = path.relative(root, file)

  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return undefined

  return file
}
