/**
 * Full-suite runner with discovery parity: the recursive test inventory is authoritative and
 * the collected suite must cover it exactly, so a partial file list can never pass as the full
 * suite. Fails closed on missing, duplicate, or empty discovery. `--self-test` exercises the
 * parity gate against tampered counts and must print OK before a real result is trusted.
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

const parityError = (expected: number, observed: number) => {
  if (expected === 0) return "empty recursive test inventory"
  if (observed === 0) return "bun collected 0 test files"
  if (observed !== expected) {
    return `bun collected ${observed} test files but the recursive inventory holds ${expected}`
  }
  return undefined
}

const discovered = (await inventory(path.join(root, "test"))).sort()
if (new Set(discovered).size !== discovered.length) {
  console.error(`discovery parity FAILED: duplicate entries in the recursive inventory (${discovered.length})`)
  process.exit(1)
}

if (process.argv.includes("--self-test")) {
  const tampered: Array<[number, number]> = [
    [discovered.length, 0],
    [discovered.length, discovered.length - 1],
    [discovered.length, discovered.length + 1],
    [0, 0],
  ]
  const missed = tampered.filter(([expected, observed]) => parityError(expected, observed) === undefined)
  if (missed.length > 0) {
    console.error(`discovery parity self-test FAILED: ${missed.length} tampered count(s) passed the gate`)
    process.exit(1)
  }
  console.log(
    `discovery parity self-test OK: ${tampered.length} tampered counts rejected (${discovered.length} files inventoried)`,
  )
  process.exit(0)
}

const inventoryError = parityError(discovered.length, discovered.length)
if (inventoryError) {
  console.error(`discovery parity FAILED: ${inventoryError}`)
  process.exit(1)
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

const child = Bun.spawn({
  cmd: [process.execPath, "test", "--timeout=30000"],
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

const summary = `${out}\n${err}`.match(/Ran \d+ tests? across (\d+) files?/)
if (!summary) {
  console.error("discovery parity FAILED: bun summary line not found in suite output")
  process.exit(1)
}
const collected = Number(summary[1])
const collectedError = parityError(discovered.length, collected)
if (collectedError) {
  console.error(`discovery parity FAILED: ${collectedError}`)
  process.exit(1)
}
console.log(`discovery parity OK: ${collected} collected = ${discovered.length} inventoried`)
process.exitCode = code
