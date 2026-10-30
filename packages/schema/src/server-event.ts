export * as ServerEvent from "./server-event.js"

import { Schema } from "effect"
import { Event } from "./event.js"

export const Connected = Event.ephemeral({
  type: "server.connected",
  schema: {
    // Present only on connections that subscribed with review=true: the server-issued
    // reviewer capability token for guarded permission replies, unique to this connection.
    reviewer: Schema.String.pipe(Schema.optional),
  },
})
export const Disposed = Event.ephemeral({ type: "global.disposed", schema: {} })

export const Definitions = Event.inventory(Connected, Disposed)
