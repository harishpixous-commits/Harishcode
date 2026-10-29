import { expect, test } from "bun:test"
import { App } from "@harishcode/core/app"

test("formats app metadata as a user agent", () => {
  expect(App.useragent(App.make({ name: "sdk", version: "1.2.3", channel: "beta" }))).toBe("harishcode/beta/1.2.3/sdk")
})
