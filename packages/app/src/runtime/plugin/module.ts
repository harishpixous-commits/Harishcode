import {
  evaluatePluginBundle,
  inertModule,
  mainOnlyModule,
  type PluginModule,
  type Entry,
} from "@harishcode/plugin/gui/host"

// Plugin bundles share the host's module instances, so tokens, contexts and schemas they import are the same objects
// the host checks against. In a window, the main SDK's name resolves to the window SDK.
const modules = {
  effect: () => import("effect"),
  "@harishcode/plugin/gui": () => import("@harishcode/plugin/gui"),
  "@harishcode/plugin/gui/main": () => import("@harishcode/plugin/gui"),
  "@harishcode/plugin/gui/file": () => import("@harishcode/plugin/gui/file"),
  "@harishcode/plugin/gui/review": () => import("@harishcode/plugin/gui/review"),
  "@harishcode/plugin/gui/browser": () => import("@harishcode/plugin/gui/browser"),
  "@harishcode/plugin/rpc": () => import("@harishcode/plugin/rpc"),
  "@harishcode/schema/rpc": () => import("@harishcode/schema/rpc"),
  "@harishcode/client": () => import("@harishcode/client"),
  "@harishcode/client/effect": () => import("@harishcode/client/effect"),
  "@harishcode/client/solid": () => import("@harishcode/client/solid"),
  "solid-js": () => import("solid-js"),
  "solid-js/web": () => import("solid-js/web"),
  "solid-js/store": () => import("solid-js/store"),
} satisfies Record<PluginModule, () => Promise<object>>

/**
 * Builds a host `Entry` for a plugin's `./gui-experimental` bundle, read from the desktop app's own server. The
 * bundle is evaluated here so the host reads its `Plugin.define` declarations (`os`, `stores`, `i18n`) before it
 * activates the plugin. A plugin with only a `main` setup gets an empty window setup, so it still lists as active. It
 * takes the server plugin's id. A bundle that fails to evaluate becomes an entry that fails, so Extensions › Plugins
 * reports it.
 */
export async function pluginDefinition(id: string, code: string): Promise<Entry> {
  const loaded = new Map<string, object>(
    await Promise.all(Object.entries(modules).map(async ([name, load]) => [name, await load()] as const)),
  )

  const bundle = await Promise.try(() =>
    evaluatePluginBundle(code, {
      process: "window",
      require: (name) => {
        const module = loaded.get(name)

        if (module) return module

        if (mainOnlyModule(name)) return inertModule(name)

        throw new Error(`Plugin GUI bundle requires a module the app does not share: ${name}`)
      },
    }),
  ).then(
    (value) => ({ ok: true as const, value }),
    (cause: unknown) => ({ ok: false as const, cause }),
  )

  if (!bundle.ok) return { id, windowEntry: () => Promise.reject(bundle.cause) }

  const setup = bundle.value.setup

  // A setup's returned cleanup reaches the host, which runs it when the plugin goes away.
  return { ...bundle.value.definition, id, windowEntry: async () => ({ default: (ctx: never) => setup?.(ctx) }) }
}
