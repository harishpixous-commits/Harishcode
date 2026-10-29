import { expect, test } from "bun:test"
import { consoleProviderGroup, consoleProviderName } from "./console"

test("groups only providers managed by the active Console workspace", () => {
  const direct = { id: "openai", integrationID: "openai", name: "Harish / OpenAI" }

  const group = consoleProviderGroup([
    { id: "harishcode", integrationID: "harishcode", name: "Harish / HarishCode" },
    { id: "console-openai", integrationID: "harishcode", name: "Harish / OpenAI" },
    { id: "console-google", integrationID: "harishcode", name: "Harish / Google" },
    direct,
  ])

  expect(group).toBeDefined()

  if (!group) throw new Error("Expected Console provider group")
  expect(group.workspace).toBe("Harish")
  expect(group.providers.map((provider) => provider.id)).toEqual(["harishcode", "console-openai", "console-google"])
  expect(consoleProviderName(group, group.providers[1].name)).toBe("OpenAI")
  expect(group.providers).not.toContain(direct)
})
