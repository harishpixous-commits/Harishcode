import { Option, Schema } from "effect"

declare const HARISHCODE_VERSION: string
declare const HARISHCODE_CHANNEL: string
declare const HARISHCODE_ARTIFACT: string
declare const HARISHCODE_RELEASE_HIGHLIGHTS: string

const version = typeof HARISHCODE_VERSION === "string" ? HARISHCODE_VERSION : "local"
const channel = typeof HARISHCODE_CHANNEL === "string" ? HARISHCODE_CHANNEL : "local"
const artifact = typeof HARISHCODE_ARTIFACT === "string" ? HARISHCODE_ARTIFACT : "cli"
// Stable release builds embed the release notes' Highlights; every other build has none.
const highlights =
  typeof HARISHCODE_RELEASE_HIGHLIGHTS === "string"
    ? Option.getOrElse(
        Schema.decodeUnknownOption(
          Schema.fromJsonString(Schema.Array(Schema.Struct({ title: Schema.String, body: Schema.String }))),
        )(HARISHCODE_RELEASE_HIGHLIGHTS),
        () => [],
      )
    : []

export {
  version as HARISHCODE_VERSION,
  channel as HARISHCODE_CHANNEL,
  artifact as HARISHCODE_ARTIFACT,
  highlights as HARISHCODE_HIGHLIGHTS,
}
export const HARISHCODE_LOCAL = channel === "local"
