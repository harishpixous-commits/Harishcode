import { Plugin } from "@harishcode/plugin/tui"
import { createMermaidCodeBlockRenderer } from "./markdown.js"
import { resolveHarishCodeDiagramPalette } from "./palette.js"

export default Plugin.define({
  id: "harishcode.merman",
  setup(context) {
    context.markdown.registerCodeBlockRenderer(
      "mermaid",
      createMermaidCodeBlockRenderer(context.renderer, () => ({
        colors: resolveHarishCodeDiagramPalette(context.theme, context.themeMode),
      })),
    )
  },
})
