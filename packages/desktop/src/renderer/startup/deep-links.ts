import type { ElectronAPI } from "../api-types"

const deepLinkEvent = "harishcode:deep-link"

export function startDeepLinks(api: ElectronAPI) {
  void api.consumeInitialDeepLinks().then(emitDeepLinks)
  api.onDeepLink(emitDeepLinks)
}

function emitDeepLinks(urls: string[]) {
  if (urls.length === 0) return
  window.__HARISHCODE__ ??= {}
  window.__HARISHCODE__.deepLinks = [...(window.__HARISHCODE__.deepLinks ?? []), ...urls]
  window.dispatchEvent(new CustomEvent(deepLinkEvent, { detail: { urls } }))
}
