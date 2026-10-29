import { ensurePluginRuntime, provides } from "@harishcode/plugin/runtime"
import { Plugin, PluginContextProvider, usePlugin } from "@harishcode/plugin/tui"
import { ensureRuntimePluginSupport } from "@opentui/solid/runtime-plugin-support/configure"

ensurePluginRuntime()
ensureRuntimePluginSupport({
  additional: {
    "@harishcode/plugin/tui": { Plugin, PluginContextProvider, usePlugin },
  },
  preserve: provides,
})
