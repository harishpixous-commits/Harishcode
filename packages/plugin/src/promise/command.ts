import type { CommandApi } from "@harishcode/client/promise/api"
import type { PromptInput } from "@harishcode/schema/prompt-input"
import type { Session } from "@harishcode/schema/session"
import type { SessionInbox } from "@harishcode/schema/session-inbox"
import type { Transform } from "./registration.js"

export interface CommandInvocation {
  readonly sessionID: Session.ID
  readonly prompt: PromptInput.Prompt
  readonly delivery: SessionInbox.Delivery
}

export interface CommandDefinition {
  readonly name: string
  readonly description?: string
  readonly execute: (input: CommandInvocation) => Promise<void>
}

export interface CommandEditor {
  add(definition: CommandDefinition): void
}

export interface CommandDomain extends Pick<CommandApi, "list"> {
  readonly transform: Transform<CommandEditor>
  readonly reload: () => Promise<void>
}
