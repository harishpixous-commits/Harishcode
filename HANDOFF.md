# Handoff — 2026-10-30 (branch `source-fixes/2026-10-29-quality-safety`)

Latest verified state of Harish Code for continued development. Base: remote tip `2c94981`.
This branch carries 14 work commits + this document. Nothing here is merged to `main`.

## What is on this branch (newest first)

- `5af7f8e` test(core): use real WASM legacy scanner in gap characterization modes
- `7950b7f` test(core): characterize pre-#60376 shell-permission parse gaps on both scanners
- `6d3cbce` test(tui): render-level acceptance for cursor config hot reload
- `cf8787a` test(core): characterize session revert recovery behavior (P2 evidence base)
- `d71a743` fix(tui): apply cursor style config on reload
- `3965829` fix(core): throttle Code Mode execute progress to one update per 100 ms
- `a3a3dd6` fix(core): preserve permission reasons and feedback on MCP failures
- `09d51e0` fix(tui): treat literal # in file prompts as part of the name
- `d3597cf` fix(session-ui): a waiting steer names only the agent and model it changes
- `37b4749` fix(session,tui,schema): preserve captured attachment source paths
- `92c2b8e` fix(tui,util): stop truncateMiddle overflowing at small widths
- `a692733` fix(core): reject persistent terminals whose cwd is not a directory
- `dc8fd25` fix(core): reject bare --fixture before the full-suite runner launches
- `308102c` docs(openhands): offline real-SDK acceptance results and reviewer composition gap

## Verified state

- Typecheck: all 8 touched packages clean individually (app, core, protocol, schema, server, session-ui, tui, util). Root `turbo typecheck` crashes with SIGSEGV in this sandbox — environmental, not a code error.
- Tests: `packages/core` suite green except pre-existing environment-bound failures (see below).
- ast-grep scan: clean.

## Known issues (pre-existing, not caused by these commits)

- `bun run lint`: `oxlint` aborts (SIGABRT, oxc allocator) in this sandbox; `script/sdk-docs.ts` reports 4 README code-block drifts in `packages/gui-plugins/` that already exist at remote tip `2c94981`.
- `packages/core` environment-bound test failures (fail identically without these commits): database-migration stale schema snapshot, GitLab OAuth (network/port), preload HOME-isolation assertion, session-runner recorded transport, codemode tool progress (5s timeout in this environment).

## Explicitly NOT adopted (isolated experiment, do not merge from here)

A portable shell-scanner security fix (upstream anomalyco/opencode #60376-class, dc0bfc5ea) with an HC-original "legacyResource" deny-compat layer exists ONLY in a separate local prototype, not on this branch. It has no adoption approval: no default flip, no stored-rule migration. Known gap meanwhile: the legacy shell scanner (used for the local channel) does not permission-check bare redirects, dynamic `cd`, `popd`, or PowerShell method calls — freeze evidence in `packages/core/test/shell-permission-gap-characterization.test.ts`.

## P2 (session revert) — evidence only

Snapshot objects are retained; commit nulls the reference and deletes message rows, so the in-product recovery link is lost while data remains. Bounded reference-history ("B0") is an unapproved design option, not implemented.
