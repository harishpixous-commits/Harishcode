import { Agent } from "@harishcode/core/agent"
import { AISDK } from "@harishcode/core/aisdk"
import { Command } from "@harishcode/core/command"
import { Config } from "@harishcode/core/config"
import { Credential } from "@harishcode/core/credential"
import { Database } from "@harishcode/core/database/database"
import { Environment } from "@harishcode/core/environment/index"
import { FileAccess } from "@harishcode/core/file-access"
import { LayerNodePlatform } from "@harishcode/util/effect/app-node-platform"
import { AppProcess } from "@harishcode/util/process"
import { LayerNode } from "@harishcode/util/effect/layer-node"
import { Bus } from "@harishcode/core/bus"
import { FileSystem } from "@harishcode/core/filesystem"
import { FSUtil } from "@harishcode/util/fs-util"
import { Global } from "@harishcode/util/global"
import { Form } from "@harishcode/core/form"
import { Generate } from "@harishcode/core/generate"
import { Integration } from "@harishcode/core/integration"
import { Job } from "@harishcode/core/job"
import { KV } from "@harishcode/core/kv"
import { Location } from "@harishcode/core/location"
import { Mcp } from "@harishcode/core/mcp/index"
import { Model } from "@harishcode/core/model"
import { Npm } from "@harishcode/util/npm"
import { Plugin } from "@harishcode/core/plugin"
import { PluginHooks } from "@harishcode/core/plugin/hooks"
import { Provider } from "@harishcode/core/provider"
import { Session } from "@harishcode/core/session"
import { InstructionEntry } from "@harishcode/core/session/instruction-entry"
import { PersistentPty } from "@harishcode/core/persistent-pty"
import { LocationServiceMap } from "@harishcode/core/location-service-map"
import { AppNodeBuilder } from "@harishcode/core/effect/app-node-builder"
import { Permission } from "@harishcode/core/permission"
import { Reference } from "@harishcode/core/reference"
import { Rpc } from "@harishcode/core/rpc"
import { Skill } from "@harishcode/core/skill"
import { SkillDiscovery } from "@harishcode/core/skill/discovery"
import { Watcher } from "@harishcode/core/filesystem/watcher"
import { Tool } from "@harishcode/core/tool"
import { Vcs } from "@harishcode/core/vcs"
import { WebSearch } from "@harishcode/core/websearch"
import { Worktree } from "@harishcode/core/worktree"
import { WorktreeStrategies } from "@harishcode/core/worktree/strategies"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"
import { emptyMcpLayer } from "../fixture/mcp"
import { offlineModels } from "../fixture/models"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: (name) => Effect.succeed({ directory: "", name }),
    resolve: (name) => Effect.succeed({ directory: "", name }),
    check: () => Effect.succeed(false),
    update: (name) => Effect.succeed({ directory: "", name }),
    which: () => Effect.undefined,
  }),
)

const generateLayer = Layer.succeed(
  Generate.Service,
  Generate.Service.of({
    text: () => Effect.succeed(""),
    image: () => Effect.die("unused"),
    decisions: () => Effect.die("unused"),
  }),
)

const configLayer = Config.testLayer()

const permissionLayer = Layer.succeed(
  Permission.Service,
  Permission.Service.of({
    close: Effect.void,
    ask: (input) => Effect.succeed({ id: input.id ?? Permission.ID.create(), effect: "ask" }),
    assert: () => Effect.void,
    assertNotDenied: () => Effect.void,
    reply: () => Effect.void,
    get: () => Effect.succeed(undefined),
    forSession: () => Effect.succeed([]),
    list: () => Effect.succeed([]),
  }),
)

export const makePluginTestLayer = (permission = permissionLayer, generate = generateLayer) =>
  AppNodeBuilder.build(
    LayerNode.group([
      AppProcess.node,
      FileSystem.node,
      FSUtil.node,
      Location.node,
      Npm.node,
      Credential.node,
      Config.node,
      Database.node,
      Environment.node,
      FileAccess.node,
      Global.node,
      Bus.node,
      Form.node,
      Generate.node,
      LayerNodePlatform.httpClient,
      Plugin.node,
      Agent.node,
      AISDK.node,
      Provider.node,
      Model.node,
      Command.node,
      Integration.node,
      Job.node,
      KV.node,
      Mcp.node,
      Session.node,
      InstructionEntry.node,
      PersistentPty.node,
      LocationServiceMap.node,
      Permission.node,
      PluginHooks.node,
      Reference.node,
      Rpc.node,
      Skill.node,
      SkillDiscovery.node,
      Tool.node,
      Vcs.node,
      Watcher.node,
      WebSearch.node,
      Worktree.node,
      WorktreeStrategies.node,
    ]),
    [
      Location.node.replace(tempLocationLayer),
      Npm.node.replace(npmLayer),
      Config.node.replace(configLayer),
      Mcp.node.replace(emptyMcpLayer),
      Generate.node.replace(generate),
      Permission.node.replace(permission),
      offlineModels,
    ],
  ).pipe(Layer.provideMerge(configLayer))

export const PluginTestLayer = makePluginTestLayer()
