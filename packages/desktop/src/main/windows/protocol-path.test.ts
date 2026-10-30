import { expect, test } from "bun:test"
import path from "node:path"
import { resolveRendererPath } from "./protocol-path"

const root = path.resolve("renderer-fixture")

test.each(["/%", "/%C0%AF", "/%E0%A4%A", "/%00", "/..%2fsecret", "/%2e%2e/secret", "/%5c..%5csecret", "index.html"])(
  "invalid renderer path %s is refused without throwing",
  (pathname) => {
    expect(resolveRendererPath(root, pathname)).toBeUndefined()
  },
)

test.each([
  ["/index.html", "index.html"],
  ["/assets/main.js", "assets/main.js"],
  ["/assets/My%20Font.woff2", "assets/My Font.woff2"],
  ["/..logo.svg", "..logo.svg"],
])("valid renderer path %s stays under the root", (pathname, relative) => {
  expect(resolveRendererPath(root, pathname)).toBe(path.join(root, relative))
})
