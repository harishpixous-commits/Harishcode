import { describe, expect, test } from "bun:test"
import path from "path"

// The full-suite runner doubles as the discovery-parity gate against saved bun output.
// A bare `--fixture` must never fall through to spawning the real suite.
const root = path.join(import.meta.dir, "..")
const run = (args: string[]) =>
  Bun.spawnSync({
    cmd: [process.execPath, path.join("script", "test-full.ts"), ...args],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  })

describe("test-full --fixture argument guard", () => {
  test("bare --fixture rejects before launching the suite", () => {
    const result = run(["--fixture"])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toString()).toContain("--fixture requires a path to saved bun test output")
  })

  test("another flag in the path position rejects", () => {
    const result = run(["--fixture", "--count-only"])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toString()).toContain("--fixture requires a path to saved bun test output")
  })
})
