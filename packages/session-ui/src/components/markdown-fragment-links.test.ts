import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { afterAll, beforeAll, expect, test } from "bun:test"
import { fragmentTarget, headingSlug, setupFragmentLinks } from "./markdown-fragment-links"

beforeAll(() => GlobalRegistrator.register())

afterAll(() => GlobalRegistrator.unregister())

test("slugs headings the way GitHub anchors them", () => {
  expect(headingSlug("Host services")).toBe("host-services")
  expect(headingSlug("What's `node:*`?")).toBe("whats-node")
  expect(headingSlug("API & SDK: v2.0")).toBe("api--sdk-v20")
  expect(headingSlug("snake_case and-hyphens")).toBe("snake_case-and-hyphens")
  expect(headingSlug("Überblick 概要")).toBe("überblick-概要")
})

test("finds headings by slug, numbering repeats, then raw HTML ids and names", () => {
  const root = document.createElement("div")
  root.innerHTML = [
    "<h2>Host services</h2>",
    "<h3>Usage</h3>",
    "<h3>Usage</h3>",
    '<p id="user-content-custom">custom</p>',
    '<a name="user-content-legacy"></a>',
  ].join("")
  const headings = root.querySelectorAll("h3")

  expect(fragmentTarget(root, "host-services")?.textContent).toBe("Host services")
  expect(fragmentTarget(root, "Host-Services")?.textContent).toBe("Host services")
  expect(fragmentTarget(root, "usage")).toBe(headings[0])
  expect(fragmentTarget(root, "usage-1")).toBe(headings[1])
  expect(fragmentTarget(root, "custom")?.textContent).toBe("custom")
  expect(fragmentTarget(root, "legacy")?.getAttribute("name")).toBe("user-content-legacy")
  expect(fragmentTarget(root, "missing")).toBeUndefined()
})

test("fragment clicks scroll only the nearest scroller and clean up", () => {
  const outer = document.createElement("div")
  outer.style.overflowY = "auto"
  const root = document.createElement("div")
  root.innerHTML = '<a href="#usage"><span>jump</span></a><h2>Usage</h2><a href="#%E0%A4%A">bad</a>'
  outer.append(root)
  document.body.append(outer)
  const calls: ScrollToOptions[] = []
  outer.scrollTo = (options?: ScrollToOptions | number, _y?: number) => {
    calls.push(options as ScrollToOptions)
  }
  const cleanup = setupFragmentLinks(root)
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
  root.querySelector("span")!.dispatchEvent(event)
  expect(event.defaultPrevented).toBe(true)
  expect(calls).toHaveLength(1)
  expect(() => root.querySelectorAll("a")[1].click()).not.toThrow()
  cleanup()
  const after = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
  root.querySelector("span")!.dispatchEvent(after)
  expect(after.defaultPrevented).toBe(false)
  expect(calls).toHaveLength(1)
  outer.remove()
})
