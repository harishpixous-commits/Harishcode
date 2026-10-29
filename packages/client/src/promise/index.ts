import type { HarishCode } from "./client.js"

export * from "./generated/index.js"
export { HarishCode } from "./client.js"
export type {
  AgentApi,
  CommandApi,
  ConfigApi,
  EventApi,
  IntegrationApi,
  ModelApi,
  PluginApi,
  ProviderApi,
  ReferenceApi,
  RpcApi,
  RpcCallOptions,
  RpcClient,
  RpcEventPayload,
  WebSearchApi,
  SessionApi,
  SkillApi,
} from "./api.js"
export type { EventSubscribeOutput as HarishCodeEvent } from "./generated/types.js"
export type {
  MediaFileAttachment as PromptMediaFileAttachment,
  Attachment as PromptAttachment,
} from "@harishcode/schema/prompt"
export type HarishCodeClient = ReturnType<typeof HarishCode.make>
