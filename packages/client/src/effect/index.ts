// TODO: Keep additional network capabilities inside Schema and Protocol as the client grows; /effect must never import
// Core or Server. Preserve these datatype exports so internal model reorganizations do not require caller migrations.
import type { Effect } from "effect"
import type { HarishCode } from "./client.js"

export * from "./generated/index"
export { HarishCode } from "./client.js"
export type {
  AgentApi,
  AppApi,
  CommandApi,
  ConfigApi,
  EventApi,
  IntegrationApi,
  ModelApi,
  PluginApi,
  ProviderApi,
  ReferenceApi,
  RpcApi,
  RpcClient,
  WebSearchApi,
  SessionApi,
  SkillApi,
} from "./api.js"
export { Agent } from "@harishcode/schema/agent"
export { Command } from "@harishcode/schema/command"
export { Config } from "@harishcode/schema/config"
export { Credential } from "@harishcode/schema/credential"
export { Event } from "@harishcode/schema/event"
export { EventLog } from "@harishcode/schema/event-log"
export { FileSystem } from "@harishcode/schema/filesystem"
export { Form } from "@harishcode/schema/form"
export { Integration } from "@harishcode/schema/integration"
export { Location } from "@harishcode/schema/location"
export { Model } from "@harishcode/schema/model"
export { Permission } from "@harishcode/schema/permission"
export { PermissionSaved } from "@harishcode/schema/permission-saved"
export { Project } from "@harishcode/schema/project"
export { Worktree } from "@harishcode/schema/worktree"
export { Vcs } from "@harishcode/schema/vcs"
export { Provider } from "@harishcode/schema/provider"
export { Pty } from "@harishcode/schema/pty"
export { Question } from "@harishcode/schema/question"
export { Reference } from "@harishcode/schema/reference"
export { WebSearch } from "@harishcode/schema/websearch"
export { AbsolutePath, RelativePath } from "@harishcode/schema/schema"
export { Session } from "@harishcode/schema/session"
export { SessionInbox } from "@harishcode/schema/session-inbox"
export { SessionMessage } from "@harishcode/schema/session-message"
export { Skill } from "@harishcode/schema/skill"
export { Prompt } from "@harishcode/schema/prompt"
export { PromptInput } from "@harishcode/schema/prompt-input"
export type { HarishCodeEvent } from "@harishcode/protocol/groups/event"
export type HarishCodeClient = Effect.Success<ReturnType<typeof HarishCode.make>>
