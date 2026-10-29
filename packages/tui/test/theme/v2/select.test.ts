import { expect, test } from "bun:test"
import { selectTheme, selectThemeMode, supportsThemeMode, themeModes } from "@harishcode/theme/tui"
import { getHarishCodeTheme } from "../../../src/theme"

test("selects complete light and dark themes independently", () => {
  const light = selectTheme(getHarishCodeTheme(), "light")
  const dark = selectTheme(getHarishCodeTheme(), "dark")
  expect(selectTheme(getHarishCodeTheme())).toEqual(light)
  expect(light.hue).toEqual(getHarishCodeTheme().light.hue)
  expect(dark.text).toEqual(getHarishCodeTheme().base.text)
  expect(dark.hue).toEqual(getHarishCodeTheme().dark.hue)
  expect(selectThemeMode(getHarishCodeTheme(), "dark")).toEqual({ theme: dark, mode: "dark" })
})

test("selects the available mode when the requested mode is missing", () => {
  const lightOnly = { base: getHarishCodeTheme().base, light: getHarishCodeTheme().light } as const
  const darkOnly = { base: getHarishCodeTheme().base, dark: getHarishCodeTheme().dark } as const

  expect(themeModes(lightOnly)).toEqual(["light"])
  expect(themeModes(darkOnly)).toEqual(["dark"])
  expect(supportsThemeMode(lightOnly, "light")).toBeTrue()
  expect(supportsThemeMode(lightOnly, "dark")).toBeFalse()
  expect(selectThemeMode(lightOnly, "dark")).toEqual({ theme: selectTheme(getHarishCodeTheme(), "light"), mode: "light" })
  expect(selectThemeMode(darkOnly, "light")).toEqual({ theme: selectTheme(getHarishCodeTheme(), "dark"), mode: "dark" })
})
