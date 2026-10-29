/**
 * Release policy for Harish Code.
 *
 * Application binaries are owned exclusively by the Harish Code release channel.
 * They are never resolved from a third-party/upstream release feed, so a build
 * made from this repository can never be silently replaced or downgraded by an
 * outside updater. Enabling app updates requires a Harish Code managed release
 * channel to be configured first (admin-controlled), which is intentionally not
 * wired yet.
 *
 * What *is* updatable today is the free-model adapter: the model catalog is a
 * separate, versioned data artifact. Refreshing it pulls new model definitions
 * without touching the installed application.
 */

/** Set to a URL only when a Harish Code controlled release feed exists. */
export const managedReleaseFeed = undefined as string | undefined

/** True when this build may install a new application binary. */
export const appUpdatesEnabled = managedReleaseFeed !== undefined

/** True when the free-model catalog may be refreshed in place. */
export const modelAdapterUpdatesEnabled = true

export const appUpdatesDisabledReason =
  "Application updates are managed by Harish Code. This build stays on its installed version."
