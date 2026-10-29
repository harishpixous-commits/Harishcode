import path from "node:path"
import { HARISHCODE_CHANNEL } from "./version"

export function databasePath(data: string) {
  const filename =
    process.env.HARISHCODE_DB ??
    (["latest", "dev", "beta", "next", "prod"].includes(HARISHCODE_CHANNEL) ||
    process.env.HARISHCODE_DISABLE_CHANNEL_DB === "1" ||
    process.env.HARISHCODE_DISABLE_CHANNEL_DB === "true"
      ? "harishcode.db"
      : `harishcode-${HARISHCODE_CHANNEL.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
  return filename === ":memory:" ? filename : path.resolve(data, filename)
}
