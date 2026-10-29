import { expect, test } from "bun:test"
import { Env } from "../src/env"

test("session environment omits server credentials", () => {
  const previousPassword = process.env.HARISHCODE_PASSWORD
  const previousLegacyPassword = process.env.HARISHCODE_SERVER_PASSWORD
  const previousValue = process.env.HARISHCODE_SESSION_ENV_TEST
  process.env.HARISHCODE_PASSWORD = "password"
  process.env.HARISHCODE_SERVER_PASSWORD = "legacy"
  process.env.HARISHCODE_SESSION_ENV_TEST = "included"

  const environment = Env.session()

  if (previousPassword === undefined) delete process.env.HARISHCODE_PASSWORD
  else process.env.HARISHCODE_PASSWORD = previousPassword
  if (previousLegacyPassword === undefined) delete process.env.HARISHCODE_SERVER_PASSWORD
  else process.env.HARISHCODE_SERVER_PASSWORD = previousLegacyPassword
  if (previousValue === undefined) delete process.env.HARISHCODE_SESSION_ENV_TEST
  else process.env.HARISHCODE_SESSION_ENV_TEST = previousValue

  expect(environment.HARISHCODE_PASSWORD).toBeUndefined()
  expect(environment.HARISHCODE_SERVER_PASSWORD).toBeUndefined()
  expect(environment.HARISHCODE_SESSION_ENV_TEST).toBe("included")
})
