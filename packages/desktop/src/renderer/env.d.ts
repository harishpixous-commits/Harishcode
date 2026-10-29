import type { ElectronNative } from "../preload/types"

declare global {
  interface ImportMetaEnv {
    readonly HARISHCODE_TEST_ONBOARDING: boolean
  }

  interface Window {
    electron: ElectronNative
    __HARISHCODE__?: {
      deepLinks?: string[]
    }
  }
}
