import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.HARISHCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.HARISHCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "HarishCode Dev",
  beta: "HarishCode Beta",
  prod: "HarishCode",
}

const appIDs: Record<string, string> = {
  dev: "ai.harishcode.desktop.dev",
  beta: "ai.harishcode.desktop.beta",
  prod: "ai.harishcode.desktop",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "HarishCode Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "ai.harishcode.desktop.dev"
