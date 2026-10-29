import { expect, test } from "bun:test"
import { EnvironmentDriver } from "@harishcode/core/environment/driver"
import { EnvironmentFiles } from "@harishcode/core/environment/files"
import { Location as CoreLocation } from "@harishcode/core/location"
import { WorkspaceDriver } from "@harishcode/core/workspace/driver"
import { SessionInbox as CoreSessionInbox } from "@harishcode/core/session/inbox"
import { SessionMessage as CoreSessionMessage } from "@harishcode/core/session/message"
import { Agent } from "@harishcode/schema/agent"
import { Config } from "@harishcode/schema/config"
import { Event } from "@harishcode/schema/event"
import { Location } from "@harishcode/schema/location"
import { Model } from "@harishcode/schema/model"
import { Project } from "@harishcode/schema/project"
import { Provider } from "@harishcode/schema/provider"
import { WebSearch } from "@harishcode/schema/websearch"
import { Session } from "@harishcode/schema/session"
import { SessionInbox } from "@harishcode/schema/session-inbox"
import { SessionMessage } from "@harishcode/schema/session-message"
import { Workspace } from "@harishcode/schema/workspace"
import { Worktree } from "@harishcode/schema/worktree"
import { Api } from "@harishcode/server/api"
import { ClientApi, clientNamespace, groupNames, promiseOmitEndpoints } from "@harishcode/protocol/client"
import { compile, emitPromise } from "@harishcode/httpapi-codegen"

const SDK = await import("../src/index")
const SDKEffect = await import("../src/effect")
const CoreAgent = await import("@harishcode/core/agent")
const CoreModel = await import("@harishcode/core/model")
const CoreProject = await import("@harishcode/core/project")
const CoreSession = await import("@harishcode/core/session")
const CoreWorktree = await import("@harishcode/core/worktree")

test("re-exports canonical contracts directly from Schema", () => {
  expect(SDK.Agent).toBe(Agent)
  expect(SDK.Config).toBe(Config)
  expect(SDK.Event).toBe(Event)
  expect(SDK.Model).toBe(Model)
  expect(SDK.WebSearch).toBe(WebSearch)
  expect(SDK.Session).toBe(Session)
  expect(SDK.Worktree).toBe(Worktree)
  expect(SDK.Workspace).toBe(Workspace)
  expect(Object.keys(SDK).sort()).toEqual([
    "AbsolutePath",
    "Agent",
    "ClientError",
    "Command",
    "Config",
    "Credential",
    "Event",
    "FileSystem",
    "Integration",
    "Location",
    "Model",
    "HarishCode",
    "Permission",
    "PermissionSaved",
    "Project",
    "Prompt",
    "PromptInput",
    "Provider",
    "Pty",
    "Question",
    "Reference",
    "RelativePath",
    "Session",
    "SessionInbox",
    "SessionMessage",
    "Skill",
    "Tool",
    "WebSearch",
    "Workspace",
    "Worktree",
  ])
})

test("Core and Server reuse the authoritative Schema and Protocol values", () => {
  expect(CoreAgent.ID).toBe(Agent.ID)
  expect(CoreLocation.Ref).toBe(Location.Ref)
  expect(CoreModel.Ref).toBe(Model.Ref)
  expect(CoreSession.Info).toBe(Session.Info)
  expect(CoreProject.Current).toBe(Project.Current)
  expect(CoreWorktree.DirectoryUnavailableError).toBeDefined()
  expect(CoreWorktree.List).toBe(Worktree.List)
  expect(CoreWorktree.Info).toBe(Worktree.Info)
  expect(CoreSessionInbox.Item).toBe(SessionInbox.Item)
  expect(CoreSessionInbox.User).toBe(SessionInbox.User)
  expect(CoreSessionInbox.Synthetic).toBe(SessionInbox.Synthetic)
  expect(CoreSessionMessage.Info).toBe(SessionMessage.Info)
  expect(CoreSessionMessage.AssistantText).toBe(SessionMessage.AssistantText)
  expect(Api.groups["server.session"].identifier).toBe("server.session")
  expect(Api.groups["server.project"].identifier).toBe("server.project")
  expect(Object.keys(ClientApi.groups)).toEqual(Object.keys(Api.groups))
  expect(Session.ID.create()).toStartWith("ses_")
  expect(String(Project.ID.global)).toBe("global")
  expect(String(Provider.ID.anthropic)).toBe("anthropic")
  expect(Workspace.ID.create()).toStartWith("wrk_")
})

test("client and Server contracts generate identically", () => {
  const server = compile(Api, { groupNames, omitEndpoints: promiseOmitEndpoints, namespace: clientNamespace })
  const client = compile(ClientApi, { groupNames, omitEndpoints: promiseOmitEndpoints, namespace: clientNamespace })

  expect(emitPromise(client)).toEqual(emitPromise(server))
})

test("re-exports workspace and environment driver contracts from @harishcode/sdk/effect", () => {
  expect(SDKEffect.WorkspaceDriver).toBe(WorkspaceDriver)
  expect(SDKEffect.EnvironmentDriver).toBe(EnvironmentDriver)
  expect(SDKEffect.EnvironmentFiles).toBe(EnvironmentFiles)
})
