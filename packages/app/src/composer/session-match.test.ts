import { expect, test } from "bun:test"
import { matchesSessionTitle } from "./session-match"

test.each([
  { title: "HARISHCODE CONSOLE", query: "open con", matches: true },
  { title: "HARISHCODE CONSOLE", query: "HARISHCODE CONSOLE", matches: true },
  { title: "HARISHCODE CONSOLE", query: "console", matches: true },
  { title: "HARISHCODE CONSOLE", query: "HARISHCODE CONSOLE ", matches: false },
  { title: "HARISHCODE CONSOLE", query: "HARISHCODE CONSOLE on", matches: false },
  { title: "HOME", query: "HOME ", matches: false },
  { title: "HOME", query: "home", matches: true },
  { title: "foobar", query: "foo bar", matches: false },
  { title: "foo bar", query: "foo bar", matches: true },
  { title: "console", query: "sole", matches: false },
])("$query against $title: $matches", (row) => {
  expect(matchesSessionTitle(row.title, row.query)).toBe(row.matches)
})
