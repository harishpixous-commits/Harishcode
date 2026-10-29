import type { FileSystem } from "@harishcode/core/filesystem"
import { Bus } from "@harishcode/core/bus"
import { Image } from "@harishcode/core/image"
import { LocationServiceMap } from "@harishcode/core/location-service-map"
import type { LocationServices } from "@harishcode/core/location-services"
import { Plugin } from "@harishcode/core/plugin"
import { PluginHooks } from "@harishcode/core/plugin/hooks"
import { Skill } from "@harishcode/core/skill"
import type { Location } from "@harishcode/schema/location"
import { makeGlobalNode } from "@harishcode/util/effect/app-node"
import { LayerNode } from "@harishcode/util/effect/layer-node"
import { Effect, Layer, LayerMap } from "effect"

// Plain-prompt unit fixtures use virtual directories.
export const promptLocationNode = makeGlobalNode({
  service: LocationServiceMap.Service,
  layer: Layer.effect(
    LocationServiceMap.Service,
    Effect.gen(function* () {
      const bus = yield* Bus.Service
      return yield* LayerMap.make(
        (_ref: Location.Ref) =>
          LayerNode.compile(LayerNode.group([PluginHooks.node, Image.node, Skill.node, Plugin.node]), {
            replacements: [
              Bus.node.replace(Layer.succeed(Bus.Service, bus)),
              Plugin.node.replace(Layer.mock(Plugin.Service, { awaitActivation: Effect.void })),
            ],
          }) as unknown as Layer.Layer<LocationServices, FileSystem.DirectoryNotFoundError>,
      )
    }),
  ),
  deps: [Bus.node],
})
