// Real-browser replacement for Happy DOM's default anchor-navigation mismatch.
// Uses an installed browser only. No downloads, user profile, app server or provider calls.
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFileSync } from "node:child_process"

const require = createRequire(new URL("../../app/package.json", import.meta.url))
const { chromium } = require("@playwright/test")
const browserPath = process.env.HARISHCODE_TEST_CHROMIUM
const bunPath = process.env.HARISHCODE_TEST_BUN
assert.ok(browserPath && bunPath, "Set HARISHCODE_TEST_CHROMIUM and HARISHCODE_TEST_BUN to installed executables")
const directory = await mkdtemp(path.join(os.tmpdir(), "harishcode-fragment-browser-"))
let browser
try {
  const output = path.join(directory, "fragment.mjs")
  execFileSync(bunPath, ["--no-install", "build", fileURLToPath(new URL("../src/components/markdown-fragment-links.ts", import.meta.url)), "--target", "browser", "--format", "esm", "--outfile", output], { stdio: "pipe" })
  browser = await chromium.launch({ executablePath: browserPath, headless: true, args: process.env.HARISHCODE_TEST_NO_SANDBOX === "1" ? ["--no-sandbox"] : [] })
  const page = await browser.newPage()
  await page.route("**/*", route => route.abort())
  await page.setContent('<div id="outer" style="height:200px;overflow-y:auto"><div id="root"><a id="jump" href="#usage-1"><span>jump</span></a><h2>Usage</h2><div style="height:600px"></div><h2>Usage</h2><div style="height:400px"></div><a id="bad" href="#%E0%A4%A">invalid encoding</a></div></div>')
  const source = await readFile(output, "utf8")
  await page.evaluate(async source => {
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
    const { setupFragmentLinks } = await import(url)
    URL.revokeObjectURL(url)
    window.fragmentCleanup = setupFragmentLinks(document.getElementById("root"))
  }, source)
  const before = page.url()
  await page.click("#jump span")
  assert.equal(page.url(), before, "Fragment handling must not navigate the application")
  const state = await page.evaluate(() => ({ scroll: document.getElementById("outer").scrollTop, difference: Math.abs(document.querySelectorAll("h2")[1].getBoundingClientRect().top - document.getElementById("outer").getBoundingClientRect().top) }))
  assert.ok(state.scroll > 500 && state.difference < 3, "Second duplicate heading must align within its scroller")
  assert.equal(await page.evaluate(() => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true })
    document.getElementById("bad").dispatchEvent(event)
    return event.defaultPrevented
  }), true)
  await page.evaluate(() => window.fragmentCleanup())
  assert.equal(await page.evaluate(() => {
    const event = new MouseEvent("click", { bubbles: true, cancelable: true })
    document.querySelector("#jump span").dispatchEvent(event)
    return event.defaultPrevented
  }), false, "Cleanup must remove the delegated handler")
  console.log("PASS: real-browser no-navigation, duplicate heading scroll, invalid URI and cleanup")
} finally {
  await browser?.close()
  await rm(directory, { recursive: true, force: true })
}
