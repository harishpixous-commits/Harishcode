import { createMemo, type JSX } from "solid-js"
import { Button } from "@harishcode/ui/button"
import { Switch } from "@harishcode/ui/switch"
import { usePlugin } from "@harishcode/plugin/gui"
import { updaterAction } from "./action"
import type { UpdaterState } from "@harishcode/plugin/gui/updater"
import { appUpdatesEnabled } from "./release-policy"
import type definition from "./index"

export default function UpdatesSection(props: { state: () => UpdaterState | undefined; run: () => void }) {
  const ctx = usePlugin<typeof definition>()
  const releaseNotes = ctx.stores.releaseNotes
  const action = createMemo(() => updaterAction(props.state()))

  return (
    <div class="settings-section">
      <h3 class="settings-section-title">{ctx.t("section.title")}</h3>

      <div data-component="settings-list">
        <Row title={ctx.t("releaseNotes.title")} description={ctx.t("releaseNotes.description")}>
          <div data-action="settings-release-notes">
            <Switch
              checked={releaseNotes.value.enabled}
              onChange={(checked) =>
                releaseNotes.update((draft) => {
                  draft.enabled = checked
                })
              }
            />
          </div>
        </Row>

        <Row
          title={ctx.t("managed.title")}
          description={appUpdatesEnabled ? ctx.t("check.description") : ctx.t("managed.description")}
        >
          {appUpdatesEnabled ? (
            <Button
              data-action="settings-check-updates"
              size="normal"
              variant="neutral"
              disabled={!action().run}
              onClick={() => props.run()}
            >
              {ctx.t(action().label)}
            </Button>
          ) : (
            <div data-slot="settings-managed-badge">{ctx.t("managed.badge")}</div>
          )}
        </Row>

        <Row title={ctx.t("models.title")} description={ctx.t("models.description")}>
          <div data-slot="settings-managed-badge">{ctx.t("models.badge")}</div>
        </Row>
      </div>
    </div>
  )
}

// The host's settings row markup; its stylesheet is loaded with the settings screen.
function Row(props: { title: string; description: string; children: JSX.Element }) {
  return (
    <div data-component="settings-row">
      <div data-slot="settings-row-copy">
        <div data-slot="settings-row-title">{props.title}</div>
        <div data-slot="settings-row-description">{props.description}</div>
      </div>
      <div data-slot="settings-row-control">{props.children}</div>
    </div>
  )
}
