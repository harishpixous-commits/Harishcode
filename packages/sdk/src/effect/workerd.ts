export * as HarishCodeWorkerd from "./workerd"

import { Layer } from "effect"
import type { Config, Scope } from "effect"
import { WorkerdProfile } from "../internal/workerd"
import { HarishCode } from "./harishcode"

export type Configuration = WorkerdProfile.Configuration

export interface CreateOptions<R = never> extends WorkerdProfile.Options {
  readonly log?: HarishCode.CreateOptions["log"]
  readonly plugins?: HarishCode.CreateOptions["plugins"]
  readonly workspaceProviders?: HarishCode.CreateOptions["workspaceProviders"]
  readonly instances?: HarishCode.CreateOptions<R>["instances"]
}

export const create = <R = never>({ log, plugins, workspaceProviders, instances, ...options }: CreateOptions<R>) => {
  const profile = WorkerdProfile.make(options)
  return HarishCode.create(
    { ...profile.options, log, plugins, workspaceProviders, instances },
    { overrides: profile.replacements },
  )
}

export const layer = <R = never>(
  options: CreateOptions<R>,
): Layer.Layer<HarishCode.Service, Config.ConfigError | Error, Exclude<R, Scope.Scope>> =>
  Layer.effect(HarishCode.Service, create(options))

export type Interface = HarishCode.Interface
export type Requirements = Scope.Scope
