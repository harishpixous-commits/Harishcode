import type { HarishCodeEvent } from "@harishcode/client"
import { useClient } from "./client"

type EventMetadata = {
  directory: string | undefined
}
type HarishCodeEventMap = { [Type in HarishCodeEvent["type"]]: Extract<HarishCodeEvent, { type: Type }> }

export function useEvent() {
  const client = useClient()

  function subscribe(handler: (event: HarishCodeEvent, metadata: EventMetadata) => void) {
    return client.event.listen(({ details }) => {
      if (details.type === "server.connected") return
      handler(details, { directory: details.location?.directory })
    })
  }

  function on<T extends HarishCodeEvent["type"]>(
    type: T,
    handler: (event: HarishCodeEventMap[T], metadata: EventMetadata) => void,
  ) {
    return client.event.on(type, (event) => {
      handler(event, { directory: event.location?.directory })
    })
  }

  return {
    subscribe,
    on,
  }
}
