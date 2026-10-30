import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

// Run an exact copy of the binary resolver with a throwing asset fixture in a fresh
// process. No native package or PTY executable is loaded, and the parent env is not changed.
async function probe(body: string, override?: string) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "harishcode-pty-load-"))
  try {
    const source = await readFile(new URL("../src/persistent-pty/binary.bun.ts", import.meta.url), "utf8")
    await writeFile(path.join(directory, "binary.ts"), source)
    await writeFile(
      path.join(directory, "pty-binding.js"),
      'throw new Error("fixture binding evaluated"); export default undefined\n',
    )
    await writeFile(path.join(directory, "probe.ts"), body)
    const env = { ...process.env }
    delete env.HARISHCODE_PTY_BIN
    if (override !== undefined) env.HARISHCODE_PTY_BIN = override
    const child = Bun.spawn([process.execPath, "--no-install", path.join(directory, "probe.ts")], {
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exit, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    return { exit, stdout, stderr }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test("unrelated service imports do not evaluate the native PTY binding", async () => {
  const result = await probe('await import("./binary.ts"); console.log("imported")')
  expect(result).toEqual({ exit: 0, stdout: "imported\n", stderr: "" })
})

test("an explicit PTY binary override does not evaluate the packaged binding", async () => {
  const result = await probe(
    'const {resolveBinary}=await import("./binary.ts"); console.log(await resolveBinary("unused"))',
    "/fixture/custom-pty",
  )
  expect(result).toEqual({ exit: 0, stdout: "/fixture/custom-pty\n", stderr: "" })
})

test("using PTY without an override still reports binding load failure", async () => {
  const result = await probe(
    'const {resolveBinary}=await import("./binary.ts"); try { await resolveBinary("unused"); process.exit(2) } catch(error) { console.log((error as Error).message) }',
  )
  expect(result).toEqual({ exit: 0, stdout: "fixture binding evaluated\n", stderr: "" })
})
