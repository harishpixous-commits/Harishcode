import { encodeFilePath } from "@harishcode/util/path"
import type { Files } from "@harishcode/plugin/gui"

/** The file:// URL of a workspace-relative path. */
export function workspaceFileURL(files: Files, path: string) {
  return `file://${encodeFilePath(`${files.root.replaceAll("\\", "/").replace(/\/+$/, "")}/${path}`)}`
}
