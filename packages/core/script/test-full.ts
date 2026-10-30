/**
 * Full-suite runner with discovery parity: the recursive test inventory is authoritative and
 * the executed suite must cover it exactly, so a partial file list can never pass as the full
 * suite. Compares executed file IDENTITIES (bun's per-file output headers) against the
 * inventory and fails closed with named missing, extra, or duplicate files; count agreement
 * alone is never treated as identity proof. If bun ever stops printing per-file headers the
 * runner falls back to count-scope only and says so - that is not an identity gate.
 * `--self-test` exercises the gate against tampered identity sets and counts and must print
 * OK before a real result is trusted.
 */
import fs from "fs/promises"
import path from "path"
import { tmpdir } from "../test/fixture/tmpdir"

const root = path.join(import.meta.dir, "..")

const inventory = async (directory: string): Promise<string[]> => {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await inventory(full)))
    else if (entry.isFile() && entry.name.endsWith(".test.ts")) files.push(full)
  }
  return files
}

const normalize = (file: string) => file.replace(/\\/g, "/").replace(/^\.\//, "")

const identityError = (expected: readonly string[], collected: readonly string[]) => {
  if (expected.length === 0) return "empty recursive test inventory"
  const want = new Set(expected)
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  const extra = new Set<string>()
  for (const file of collected) {
    if (seen.has(file)) duplicates.add(file)
    seen.add(file)
    if (!want.has(file)) extra.add(file)
  }
  const missing = expected.filter((file) => !seen.has(file))
  if (collected.length === 0) return "bun executed 0 test files"
  const problems: string[] = []
  if (missing.length > 0) problems.push(`missing: ${missing.join(", ")}`)
  if (extra.size > 0) problems.push(`extra: ${[...extra].join(", ")}`)
  if (duplicates.size > 0) problems.push(`duplicates: ${[...duplicates].join(", ")}`)
  return problems.length > 0 ? problems.join("; ") : undefined
}

const countError = (expected: number, observed: number) => {
  if (expected === 0) return "empty recursive test inventory"
  if (observed === 0) return "bun collected 0 test files"
  if (observed !== expected) {
    return `bun collected ${observed} test files but the recursive inventory holds ${expected}`
  }
  return undefined
}

const relative = (file: string) => normalize(path.relative(root, file))

const discovered = (await inventory(path.join(root, "test"))).map(relative).sort()
if (new Set(discovered).size !== discovered.length) {
  console.error(`discovery parity FAILED: duplicate entries in the recursive inventory (${discovered.length})`)
  process.exit(1)
}
if (discovered.length === 0) {
  console.error("discovery parity FAILED: empty recursive test inventory")
  process.exit(1)
}

if (process.argv.includes("--self-test")) {
  const swapped = discovered.map((file, index) => (index === 0 ? "test/__parity_substitution__.test.ts" : file))
  const tamperedIdentities: Array<[readonly string[], readonly string[]]> = [
    [discovered, []],
    [discovered, discovered.slice(1)],
    [discovered, [...discovered, "test/__parity_extra__.test.ts"]],
    [discovered, [...discovered, discovered[0]!]],
    [discovered, swapped],
    [[], []],
  ]
  const tamperedCounts: Array<[number, number]> = [
    [discovered.length, 0],
    [discovered.length, discovered.length - 1],
    [discovered.length, discovered.length + 1],
  ]
  const missed =
    tamperedIdentities.filter(([expected, collected]) => identityError(expected, collected) === undefined).length +
    tamperedCounts.filter(([expected, observed]) => countError(expected, observed) === undefined).length
  if (missed > 0) {
    console.error(`discovery parity self-test FAILED: ${missed} tampered input(s) passed the gate`)
    process.exit(1)
  }
  if (identityError(discovered, discovered) !== undefined || countError(discovered.length, discovered.length) !== undefined) {
    console.error("discovery parity self-test FAILED: the untampered inventory was rejected")
    process.exit(1)
  }
  console.log(
    `discovery parity self-test OK: ${tamperedIdentities.length} tampered identity sets and ${tamperedCounts.length} tampered counts rejected, clean inventory accepted (${discovered.length} files)`,
  )
  process.exit(0)
}

await using directory = await tmpdir("oc-full-")
const home = directory.path
const temporary = path.join(home, "tmp")
await fs.mkdir(temporary)

const environment = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => {
      if (process.env.RECORD === "true" && name === "OPENAI_API_KEY") return true
      if (
        /^(?:AWS|AZURE|GOOGLE|GCP|GCLOUD|VERTEX|OPENAI|ANTHROPIC|GEMINI|XAI|CLOUDFLARE|CF_AIG|SNOWFLAKE|AICORE|GITLAB|NPM_CONFIG)_/i.test(
          name,
        )
      ) {
        return false
      }
      return !/(?:^|_)(?:API_KEY|AUTHORIZATION|TOKEN|SECRET|PASSWORD|CREDENTIALS?)$/i.test(name)
    }),
  ),
  HOME: home,
  HARISHCODE_TEST_HOME: home,
  XDG_CONFIG_HOME: path.join(home, ".config"),
  XDG_DATA_HOME: path.join(home, ".local", "share"),
  XDG_CACHE_HOME: path.join(home, ".cache"),
  XDG_STATE_HOME: path.join(home, ".local", "state"),
  HARISHCODE_CONFIG_DIR: path.join(home, ".config", "harishcode"),
  HARISHCODE_CONFIG: undefined,
  HARISHCODE_CONFIG_CONTENT: undefined,
  TMPDIR: temporary,
  ...(process.platform === "win32" ? { USERPROFILE: home, TMP: temporary, TEMP: temporary } : {}),
}

const countOnly = process.argv.includes("--count-only")
const fixtureIndex = process.argv.indexOf("--fixture")
const fixturePath = fixtureIndex === -1 ? undefined : process.argv[fixtureIndex + 1]
// A bare `--fixture` (no path, or another flag where the path belongs) must never fall
// through to the real suite: reject before launch.
if (fixtureIndex !== -1 && (!fixturePath || fixturePath.startsWith("--"))) {
  console.error("discovery parity FAILED: --fixture requires a path to saved bun test output")
  process.exit(1)
}

const run = async (): Promise<{ code: number; output: string }> => {
  if (fixturePath !== undefined) {
    // Fixture mode exercises the gate against saved output (or a synthetic tampered copy)
    // without spawning the suite; it never substitutes for a real full-suite result.
    const output = await fs.readFile(fixturePath, "utf8")
    return { code: 0, output }
  }
  const child = Bun.spawn({
  cmd: [process.execPath, "test", "--timeout=30000"],
  // The inventory is rooted at this package; the spawned suite must run from the same root or
  // the two sides of the comparison measure different trees.
  cwd: root,
  env: environment,
  stdin: "inherit",
  stdout: "pipe",
  stderr: "pipe",
})
const interrupt = () => child.kill("SIGINT")
const terminate = () => child.kill("SIGTERM")
process.once("SIGINT", interrupt)
process.once("SIGTERM", terminate)
const [code, out, err] = await Promise.all([
  child.exited,
  new Response(child.stdout).text(),
  new Response(child.stderr).text(),
])
process.off("SIGINT", interrupt)
process.off("SIGTERM", terminate)
process.stdout.write(out)
process.stderr.write(err)
return { code, output: `${out}\n${err}` }
}

const { code, output } = await run()
const collected = [...output.matchAll(/^(.+\.test\.ts):$/gm)].map((match) => normalize(match[1]!))
if (collected.length === 0) {
  const summary = output.match(/Ran \d+ tests? across (\d+) files?/)
  // Identity is the default gate: without per-file headers there is nothing to compare, so
  // count agreement alone is never a silent pass. Count-scope requires the explicit
  // --count-only opt-in and is printed as weaker evidence when used.
  if (!summary || !countOnly) {
    console.error(
      `discovery parity FAILED: no per-file headers in suite output${summary ? "" : " or bun summary"}; identity gate cannot run (pass --count-only to explicitly accept count-scope evidence)`,
    )
    process.exit(1)
  }
  const fallback = countError(discovered.length, Number(summary[1]))
  if (fallback) {
    console.error(`discovery parity FAILED: ${fallback}`)
    process.exit(1)
  }
  console.warn(
    `discovery parity COUNT-SCOPE ONLY (--count-only): identity unverified (${summary[1]} collected = ${discovered.length} inventoried)`,
  )
  process.exitCode = code
} else {
  const failure = identityError(discovered, collected)
  if (failure) {
    console.error(`discovery parity FAILED: ${failure}`)
    process.exit(1)
  }
  console.log(`discovery parity OK: ${collected.length} executed file identities = ${discovered.length} inventoried`)
  process.exitCode = code
}
