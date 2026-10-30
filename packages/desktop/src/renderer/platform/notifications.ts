import type { Platform } from "@harishcode/app/desktop"
import type { ElectronAPI } from "../api-types"

type DesktopNotifyAPI = Pick<ElectronAPI, "getWindowFocused" | "showWindow" | "setWindowFocus">

const MAX_ACTIVE_NOTIFICATIONS = 40

const activeNotifications = new Set<Notification>()

export function createDesktopNotify(api: DesktopNotifyAPI): Platform["notify"] {
  return async (title, description, onClick) => {
    const focused = await api.getWindowFocused().catch(() => document.hasFocus())

    if (focused) return

    // No icon: the OS draws the channel's own app icon (the HarishCode mark) from the packaged bundle and
    // the AppUserModelID, so notifications stay branded and keep working offline.
    const notification = new Notification(title, {
      body: description ?? "",
      silent: true,
    })

    if (activeNotifications.size >= MAX_ACTIVE_NOTIFICATIONS) {
      const oldest = activeNotifications.values().next().value

      if (oldest) activeNotifications.delete(oldest)
    }

    activeNotifications.add(notification)

    const release = () => {
      activeNotifications.delete(notification)
      notification.onclick = null
      notification.onclose = null
      notification.onerror = null
    }

    notification.onclose = release
    notification.onerror = release

    notification.onclick = () => {
      release()
      void Promise.all([api.showWindow(), api.setWindowFocus()])
      onClick?.()
      notification.close()
    }
  }
}
