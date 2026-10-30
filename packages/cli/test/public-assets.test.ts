import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFile, realpath } from "node:fs/promises"
import path from "node:path"

// Portable copies preserve Harish Code's own assets even on checkouts without symlink support.
test("public image copies match their contained Harish Code source assets", async () => {
  const root = await realpath(new URL("../../../", import.meta.url))
  const sources: { path: string; source: string; sha256: string }[] = JSON.parse(
    await readFile(path.join(root, "script/public-asset-sources.json"), "utf8"),
  )
  expect(sources).toHaveLength(42)
  for (const item of sources) {
    for (const name of [item.path, item.source]) {
      const resolved = await realpath(path.join(root, name))
      expect(resolved.startsWith(root + path.sep)).toBe(true)
    }
    const source = await readFile(path.join(root, item.source))
    const copy = await readFile(path.join(root, item.path))
    expect(copy.equals(source)).toBe(true)
    expect(createHash("sha256").update(copy).digest("hex")).toBe(item.sha256)
    if (item.path.endsWith(".png")) expect([...copy.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    if (item.path.endsWith(".ico")) expect([...copy.subarray(0, 4)]).toEqual([0, 0, 1, 0])
    if (item.path.endsWith(".svg")) expect(copy.toString().trimStart().startsWith("<svg")).toBe(true)
    if (item.path.endsWith(".webmanifest")) expect(JSON.parse(copy.toString()).name).toContain("Harish")
  }
})
