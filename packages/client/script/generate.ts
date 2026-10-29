import { NodeFileSystem } from "@effect/platform-node"
import { compile, emitEffectImported, emitEffectShape, emitPromise, write } from "@harishcode/httpapi-codegen"
import {
  ClientApi,
  clientNamespace,
  effectOmitEndpoints,
  groupNames,
  promiseOmitEndpoints,
} from "@harishcode/protocol/client"
import { Agent } from "@harishcode/schema/agent"
import { Command } from "@harishcode/schema/command"
import { Config } from "@harishcode/schema/config"
import { Credential } from "@harishcode/schema/credential"
import { Event } from "@harishcode/schema/event"
import { EventLog } from "@harishcode/schema/event-log"
import { FileDiff } from "@harishcode/schema/file-diff"
import { FileSystem } from "@harishcode/schema/filesystem"
import { Form } from "@harishcode/schema/form"
import { Generate } from "@harishcode/schema/generate"
import { Instruction } from "@harishcode/schema/instruction"
import { InstructionEntry } from "@harishcode/schema/instruction-entry"
import { Integration } from "@harishcode/schema/integration"
import { Location } from "@harishcode/schema/location"
import { Mcp } from "@harishcode/schema/mcp"
import { Model } from "@harishcode/schema/model"
import { Money } from "@harishcode/schema/money"
import { Permission } from "@harishcode/schema/permission"
import { PermissionSaved } from "@harishcode/schema/permission-saved"
import { Plugin } from "@harishcode/schema/plugin"
import { Project } from "@harishcode/schema/project"
import { Worktree } from "@harishcode/schema/worktree"
import { AgentAttachment, FileAttachment, Prompt, PromptMention } from "@harishcode/schema/prompt"
import { PromptInput } from "@harishcode/schema/prompt-input"
import { Provider } from "@harishcode/schema/provider"
import { Pty } from "@harishcode/schema/pty"
import { PtyTicket } from "@harishcode/schema/pty-ticket"
import { Question } from "@harishcode/schema/question"
import { Reference } from "@harishcode/schema/reference"
import { AbsolutePath, RelativePath } from "@harishcode/schema/schema"
import { Schedule } from "@harishcode/schema/schedule"
import { Session } from "@harishcode/schema/session"
import { SessionMessage } from "@harishcode/schema/session-message"
import { SessionInbox } from "@harishcode/schema/session-inbox"
import { Shell } from "@harishcode/schema/shell"
import { Skill } from "@harishcode/schema/skill"
import { Snapshot } from "@harishcode/schema/snapshot"
import { UsageLimits } from "@harishcode/schema/usage-limits"
import { Vcs } from "@harishcode/schema/vcs"
import { WebSearch } from "@harishcode/schema/websearch"
import { Workspace } from "@harishcode/schema/workspace"
import { Effect, Schema } from "effect"
import { fileURLToPath } from "url"

const promiseContract = compile(ClientApi, {
  groupNames,
  omitEndpoints: promiseOmitEndpoints,
  namespace: clientNamespace,
  aliases: true,
})
const effectContract = compile(ClientApi, {
  groupNames,
  omitEndpoints: effectOmitEndpoints,
  namespace: clientNamespace,
  aliases: true,
})
const effectTypeReferences = [
  ...namespaceTypes("Agent", "@harishcode/schema/agent", Agent),
  ...namespaceTypes("Command", "@harishcode/schema/command", Command),
  ...namespaceTypes("Config", "@harishcode/schema/config", Config),
  ...namespaceTypes("Credential", "@harishcode/schema/credential", Credential),
  ...namespaceTypes("Event", "@harishcode/schema/event", Event),
  ...namespaceTypes("EventLog", "@harishcode/schema/event-log", EventLog),
  ...namespaceTypes("FileDiff", "@harishcode/schema/file-diff", FileDiff),
  ...namespaceTypes("FileSystem", "@harishcode/schema/filesystem", FileSystem),
  ...namespaceTypes("Form", "@harishcode/schema/form", Form),
  ...namespaceTypes("Generate", "@harishcode/schema/generate", Generate),
  ...namespaceTypes("Instruction", "@harishcode/schema/instruction", Instruction),
  ...namespaceTypes("InstructionEntry", "@harishcode/schema/instruction-entry", InstructionEntry),
  ...namespaceTypes("Integration", "@harishcode/schema/integration", Integration),
  typeReference("Location.PublicRef", "@harishcode/schema/location", Location.PublicRef),
  typeReference("Location.PublicInfo", "@harishcode/schema/location", Location.PublicInfo),
  ...namespaceTypes("Mcp", "@harishcode/schema/mcp", Mcp),
  ...namespaceTypes("Model", "@harishcode/schema/model", Model),
  ...namespaceTypes("Money", "@harishcode/schema/money", Money),
  ...namespaceTypes("Permission", "@harishcode/schema/permission", Permission),
  ...namespaceTypes("PermissionSaved", "@harishcode/schema/permission-saved", PermissionSaved),
  ...namespaceTypes("Plugin", "@harishcode/schema/plugin", Plugin),
  ...namespaceTypes("Project", "@harishcode/schema/project", Project),
  ...namespaceTypes("Worktree", "@harishcode/schema/worktree", Worktree),
  ...namespaceTypes("PromptInput", "@harishcode/schema/prompt-input", PromptInput),
  ...namespaceTypes("Provider", "@harishcode/schema/provider", Provider),
  ...namespaceTypes("Pty", "@harishcode/schema/pty", Pty),
  ...namespaceTypes("PtyTicket", "@harishcode/schema/pty-ticket", PtyTicket),
  ...namespaceTypes("Question", "@harishcode/schema/question", Question),
  ...namespaceTypes("Reference", "@harishcode/schema/reference", Reference),
  ...namespaceTypes("Schedule", "@harishcode/schema/schedule", Schedule),
  ...namespaceTypes("Session", "@harishcode/schema/session", Session),
  ...namespaceTypes("SessionMessage", "@harishcode/schema/session-message", SessionMessage),
  ...namespaceTypes("SessionInbox", "@harishcode/schema/session-inbox", SessionInbox),
  ...namespaceTypes("Shell", "@harishcode/schema/shell", Shell),
  ...namespaceTypes("Skill", "@harishcode/schema/skill", Skill),
  ...namespaceTypes("Snapshot", "@harishcode/schema/snapshot", Snapshot),
  ...namespaceTypes("UsageLimits", "@harishcode/schema/usage-limits", UsageLimits),
  ...namespaceTypes("Vcs", "@harishcode/schema/vcs", Vcs),
  ...namespaceTypes("WebSearch", "@harishcode/schema/websearch", WebSearch),
  ...namespaceTypes("Workspace", "@harishcode/schema/workspace", Workspace),
  typeReference("Prompt", "@harishcode/schema/prompt", Prompt),
  typeReference("PromptMention", "@harishcode/schema/prompt", PromptMention),
  typeReference("FileAttachment", "@harishcode/schema/prompt", FileAttachment),
  typeReference("AgentAttachment", "@harishcode/schema/prompt", AgentAttachment),
  typeReference("AbsolutePath", "@harishcode/schema/schema", AbsolutePath),
  typeReference("RelativePath", "@harishcode/schema/schema", RelativePath),
]

await Effect.runPromise(
  Effect.all(
    [
      write(
        emitPromise(promiseContract, {
          mutableOutputs: true,
        }),
        fileURLToPath(new URL("../src/promise/generated", import.meta.url)),
      ),
      write(
        emitEffectImported(effectContract, {
          module: "../../contract",
          api: "ClientApi",
          shapeModule: "../api/api.js",
        }),
        fileURLToPath(new URL("../src/effect/generated", import.meta.url)),
      ),
      write(
        emitEffectShape(effectContract, {
          typeReferences: effectTypeReferences,
          outputTypes: {
            "event.subscribe": {
              name: "HarishCodeEvent",
              import: 'import type { HarishCodeEvent } from "@harishcode/protocol/groups/event"',
            },
          },
        }),
        fileURLToPath(new URL("../src/effect/api", import.meta.url)),
      ),
    ],
    { concurrency: 3, discard: true },
  ).pipe(Effect.provide(NodeFileSystem.layer)),
)

function namespaceTypes(namespace: string, module: string, values: object) {
  return Object.entries(values).flatMap(([name, schema]) =>
    Schema.isSchema(schema) ? [typeReference(`${namespace}.${name}`, module, schema)] : [],
  )
}

function typeReference(name: string, module: string, schema: Schema.Top) {
  return {
    schema,
    name,
    import: `import type { ${name.split(".")[0]} } from ${JSON.stringify(module)}`,
  }
}
