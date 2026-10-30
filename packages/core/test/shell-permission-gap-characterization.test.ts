/**
 * CHARACTERIZATION TESTS - gap evidence, NOT desired end state.
 *
 * These tests freeze the CURRENT (pre-#60376) shell-permission parse outcomes on BOTH
 * shipped scanner paths (legacy tree-sitter WASM and portable ShellScan) for the gap
 * classes fixed upstream by anomalyco/opencode PR #60376 ("check redirects, PowerShell
 * method calls, dynamic directory changes").
 *
 * End-to-end meaning of an empty outcome (traced 2026-10-30, source-only, non-executing):
 * packages/core/src/tool/plugin/shell.ts skips permission.assert entirely when
 * parsed.commands.length === 0, and FileAccess.authorizeExternal only asserts for
 * external directories - so a command line that parses to {commands:[],directories:[]}
 * from an in-project cwd reaches spawn with ZERO permission interaction. A ".*"
 * directory resource resolves lexically inside cwd and likewise produces no ask.
 *
 * GAP cases below assert the current (vulnerable) outcome to preserve evidence.
 * When a #60376-class fix lands, these assertions must be FLIPPED to the fixed outcome.
 */
import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import { ShellParse } from "@harishcode/core/shell/parse"
import { shellParserWasm } from "../src/shell/parser-wasm.bun"

const scan = (command: string, shell: string, mode: "portable" | "legacy") =>
  Effect.runPromise(ShellParse.scan(command, shell, "/tmp", mode === "portable" ? { portable: true } : { wasm: shellParserWasm }))

const modes: Array<"portable" | "legacy"> = ["portable", "legacy"]

for (const mode of modes) {
  describe(`ShellParse permission-gap characterization (${mode} scanner, pre-#60376)`, () => {
    // --- Redirect classes ---
    test("GAP: bare redirect `> file` produces no command and no permission ask", async () => {
      expect(await scan("> /tmp/hc-gap/x", "/bin/bash", mode)).toEqual({ commands: [], directories: [] })
    })
    test("GAP(partial): group redirect asks only about inner command, not the redirect target", async () => {
      expect(await scan("{ echo hi; } > /tmp/hc-gap/out", "/bin/bash", mode)).toEqual({
        commands: [{ resource: "echo hi", save: "echo *" }],
        directories: [],
      })
    })
    test("CONTROL: exec fd redirect produces a command ask", async () => {
      expect(await scan("exec 3>/tmp/hc-gap/log", "/bin/bash", mode)).toEqual({
        commands: [{ resource: "exec 3>/tmp/hc-gap/log", save: "exec *" }],
        directories: [],
      })
    })
    test("CONTROL: trailing redirect still yields a command ask (file target not separately authorized)", async () => {
      const result = await scan("echo hi > /tmp/hc-gap/out", "/bin/bash", mode)
      expect(result.directories).toEqual([])
      expect(result.commands.length).toBeGreaterThan(0)
      expect(result.commands[0].save).toBe("echo *")
    })
    test("mid-command redirect: record current outcome for redirectWordCount semantics", async () => {
      // #60376 changes redirectWordCount semantics; freeze what HC does today.
      const result = await scan("echo > /tmp/hc-gap/x hi", "/bin/bash", mode)
      console.log(`[characterize:${mode}] mid-command redirect outcome:`, JSON.stringify(result))
      expect(result).toBeDefined()
    })

    // --- Dynamic directory changes ---
    test("GAP: `cd $VAR` produces no directory resource and no command ask", async () => {
      expect(await scan("cd $HC_GAP_DIR", "/bin/bash", mode)).toEqual({ commands: [], directories: [] })
    })
    test("GAP: bare `cd` produces no directory resource and no command ask", async () => {
      expect(await scan("cd", "/bin/bash", mode)).toEqual({ commands: [], directories: [] })
    })
    test("GAP: `cd -` (previous dir) produces no resource and no ask", async () => {
      expect(await scan("cd -", "/bin/bash", mode)).toEqual({ commands: [], directories: [] })
    })
    test("GAP: `popd` produces no directory resource and no command ask", async () => {
      expect(await scan("popd", "/bin/bash", mode)).toEqual({ commands: [], directories: [] })
    })
    test("CONTROL: `pushd /etc` resolves the directory resource", async () => {
      expect(await scan("pushd /etc", "/bin/bash", mode)).toEqual({ commands: [], directories: ["/etc"] })
    })

    // --- PowerShell classes ---
    test("GAP: PowerShell static method call is fully unchecked", async () => {
      expect(await scan("[IO.File]::WriteAllText('/tmp/hc-gap/m','x')", "powershell", mode)).toEqual({
        commands: [],
        directories: [],
      })
    })
    test("GAP: PowerShell wildcard path resolves as a bogus literal directory resource", async () => {
      expect(await scan("Set-Location -Path .*", "powershell", mode)).toEqual({ commands: [], directories: [".*"] })
    })
    test("GAP: PowerShell literal-path variable produces no resource and no ask", async () => {
      expect(await scan("Set-Location -LiteralPath $target", "powershell", mode)).toEqual({ commands: [], directories: [] })
    })
    test("CONTROL: Pop-Location produces a command ask", async () => {
      expect(await scan("Pop-Location", "powershell", mode)).toEqual({
        commands: [{ resource: "Pop-Location", save: "Pop-Location *" }],
        directories: [],
      })
    })
  })
}
