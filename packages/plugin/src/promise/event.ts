import type { HarishCodeEvent } from "@harishcode/client"
import type { SelectedEvent, SubscribeOptions } from "@harishcode/client/promise/api"

type EventType = Exclude<HarishCodeEvent["type"], "server.connected">

export interface EventDomain {
  readonly subscribe: <Type extends EventType = EventType>(
    options?: SubscribeOptions<Type>,
  ) => AsyncIterable<SelectedEvent<HarishCodeEvent, Type>>
}
