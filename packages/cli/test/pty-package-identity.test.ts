import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

// Exact production resolver, isolated package metadata and inert bytes. Never starts a PTY.
test("PTY packaging resolves all published upstream asset identities without rebranding the API", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "harishcode-pty-package-"))
  try {
    const source = await readFile(new URL("../script/harishcode-pty.ts", import.meta.url), "utf8")
    const directory = path.join(root, "packages/cli/script")
    await mkdir(directory, { recursive: true })
    await mkdir(path.join(root, "packages/core"), { recursive: true })
    await writeFile(path.join(root, "packages/core/package.json"), '{"name":"fixture-core"}')
    await writeFile(path.join(directory, "resolver.ts"), source)
    const modules = path.join(root, "node_modules/@opencode-ai")
    await mkdir(path.join(modules, "pty"), { recursive: true })
    await writeFile(path.join(modules, "pty/package.json"), '{"name":"@opencode-ai/pty","version":"0.3.1"}')
    const bytes = "inert fixture, not an executable"
    for (const platform of ["darwin", "linux", "win32"]) {
      for (const arch of ["arm64", "x64"]) {
        for (const libc of platform === "linux" ? ["glibc", "musl"] : [undefined]) {
          const suffix = [platform, arch, libc === "glibc" ? "gnu" : libc].filter(Boolean).join("-")
          const pkg = path.join(modules, `pty-${suffix}`)
          await mkdir(path.join(pkg, "bin"), { recursive: true })
          await writeFile(
            path.join(pkg, "package.json"),
            JSON.stringify({ name: `@opencode-ai/pty-${suffix}`, version: "0.3.1" }),
          )
          await writeFile(path.join(pkg, "bin", platform === "win32" ? "opencode-pty.exe" : "opencode-pty"), bytes)
        }
      }
    }
    const probe = `
      import {resolveHarishcodePty} from './resolver.ts';
      delete process.env.HARISHCODE_PTY_BIN;
      const results=[];
      for(const platform of ['darwin','linux','win32']) for(const arch of ['arm64','x64'])
        for(const libc of platform==='linux'?['glibc','musl']:[undefined])
          results.push(await resolveHarishcodePty({platform,arch,libc}));
      results.push(await resolveHarishcodePty({platform:'freebsd',arch:'x64'}) ?? null);
      results.push(await resolveHarishcodePty({platform:'linux',arch:'riscv64'}) ?? null);
      console.log(JSON.stringify(results));
    `
    await writeFile(path.join(directory, "probe.ts"), probe)
    const child = Bun.spawn([process.execPath, "--no-install", path.join(directory, "probe.ts")], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exit, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(stderr).toBe("")
    expect(exit).toBe(0)
    const results = JSON.parse(stdout)
    expect(results).toHaveLength(10)
    for (const item of results.slice(0, 8)) {
      expect(item.version).toBe("0.3.1")
      expect(item.sha256).toBe(createHash("sha256").update(bytes).digest("hex"))
      expect(item.source).toContain("@opencode-ai/pty-")
      expect(item.source).toMatch(/[/\\]opencode-pty(?:\.exe)?$/)
    }
    expect(results.slice(8)).toEqual([null, null])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("external PTY dependency metadata retains the published scope and exact pin", async () => {
  for (const name of ["core", "cli", "server"]) {
    const pkg = JSON.parse(await readFile(new URL(`../../${name}/package.json`, import.meta.url), "utf8"))
    expect((name === "server" ? pkg.devDependencies : pkg.dependencies)["@opencode-ai/pty"]).toBe("0.3.1")
    expect(pkg.dependencies["@harishcode-ai/pty"] ?? pkg.devDependencies?.["@harishcode-ai/pty"]).toBeUndefined()
  }
  const binding = await readFile(new URL("../../core/src/persistent-pty/pty-binding.ts", import.meta.url), "utf8")
  expect(binding).toContain('from "@opencode-ai/pty"')
  const lock = await readFile(new URL("../../../bun.lock", import.meta.url), "utf8")
  expect(lock).not.toContain("@harishcode-ai/pty")
  expect(lock).toContain('"bin": { "opencode-pty": "bin/opencode-pty.js" }')
})

test("external development and terminal sources keep their pinned upstream identities", async () => {
  const desktop = JSON.parse(await readFile(new URL("../../desktop/package.json", import.meta.url), "utf8"))
  expect(
    desktop.devDependencies["@brendonovich/vite-plugin-opencode"] ??
      desktop.dependencies["@brendonovich/vite-plugin-opencode"],
  ).toBe("0.1.3")
  const picker = await readFile(new URL("../../desktop/script/picker.ts", import.meta.url), "utf8")
  expect(picker).toContain('from "@brendonovich/vite-plugin-opencode"')
  for (const name of ["app", "gui-plugins"]) {
    const pkg = JSON.parse(await readFile(new URL(`../../${name}/package.json`, import.meta.url), "utf8"))
    expect(pkg.dependencies["ghostty-web"] ?? pkg.devDependencies?.["ghostty-web"]).toBe(
      "github:anomalyco/ghostty-web#e91e38a9ceb13c566ddfa15185a9393849f712a9",
    )
  }
  const lock = await readFile(new URL("../../../bun.lock", import.meta.url), "utf8")
  for (const name of ["client", "schema", "protocol"]) {
    expect(lock).toContain(`"@opencode-ai/${name}@0.0.0-beta-18050"`)
    expect(lock).not.toContain(`@harishcode-ai/${name}`)
  }
})
