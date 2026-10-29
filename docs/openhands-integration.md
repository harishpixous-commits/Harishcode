# OpenHands integration analysis and implementation plan

Research baseline, 2026-10-29: Canvas `2942cdf8f3f7c9d9b3fe57e35e3138c4051b6420`, SDK `bf9cb742acae7265d83b29f2f5967ec55ee69fa2`. These immutable checkouts, not a release headline or stale commits page, anchor this analysis. Integration is in progress, not connected or accepted.

## What the supplied repository contains

`OpenHands/OpenHands` is currently `@openhands/agent-canvas` 1.34.0: a React/Electron control application and local-stack launcher. It selects local, Docker, VM and cloud backends and consumes an Agent Server API. The Python agent engine, tools, security and Agent Server are in `OpenHands/software-agent-sdk`. Scheduling/webhooks/run dispatch belong to `OpenHands/automation`. Copying Canvas alone does not put the OpenHands engine into Harish Code.

Canvas root license: MIT, copyright 2025 OpenHands contributors. SDK root license: MIT, copyright 2026 OpenHands contributors. Preserve the applicable full permission/copyright notices for reused code. Root licenses do not grant rights to commercial hosted infrastructure, all dependency assets, trademarks or unrelated components. No upstream implementation code has been copied into the metadata probe.

## Both connection directions

| Route | Benefit | Existing foundation | Important limit |
| --- | --- | --- | --- |
| Harish Code as an ACP agent in Canvas | Use Canvas conversation/automation controls while Harish Code remains the coding agent | Harish Code already has `harishcode acp`, sessions, model selection, notifications, approval replies and cancellation | SDK ACP bridge currently auto-selects the first permission option. A naive connection bypasses meaningful user review. Not enabled. |
| OpenHands engine as an optional Harish Code backend | Use OpenHands reasoning/tools/workspaces without replacing Harish Code's Solid UI | HTTP/WebSocket API and typed client exist upstream; Harish Code already has remote server/session infrastructure | APIs, event histories, cancellation, auth, approval and workspace models differ. Requires an explicit adapter, not a provider-name rename. |
| Selective UI implementation reuse | Learn from backend selection, secret scoping, run history and error handling | Both products have similar control surfaces | Canvas React components are not drop-in Solid components. Copying both applications adds duplicate state and dependencies. |

The user explicitly requested the Canvas-compatible connection too. It must not be silently substituted for the separate engine-inside-Harish-Code goal, and neither direction is claimed working yet.

## Capability comparison

| Capability | Harish Code source evidence | OpenHands evidence | Integration position |
| --- | --- | --- | --- |
| ACP sessions, model choices, permissions | `packages/cli/src/acp`, CLI `acp` handler | Canvas ACP registry and SDK ACPAgent | Existing protocol is the first connection foundation, not a new missing feature |
| Scheduled work | `packages/core/src/schedule`, schedule tool/command | Separate automation service | Do not install a second scheduler blindly |
| Goals/subagents | Goal plugin, subagent tool/jobs | SDK agent and conversation APIs | Map cancellation, parent ownership and persistence rather than duplicate labels |
| MCP and skills | Core config/plugins/skills | SDK and Canvas settings | Match actual schemas and permission scope; never transfer saved secrets automatically |
| Browser tools | `packages/plugin-browser` registered | SDK tools and remote workspace | Runtime/browser isolation still requires tests |
| Remote server selection | App runtime server registry | Canvas backend registry | Different API contracts, not interchangeable URLs |
| Isolated workspace lifecycle | Existing process/worktree and runtime code; no blanket sandbox claim | SDK Docker/remote workspaces | Container configuration and mounts must be verified; 'docker' metadata is not proof of containment |
| Provider choice | Harish Code AI package/providers | SDK LLM settings | Existing provider identity and budgets must stay visible; no live provider was used |
| UI framework | Solid, Bun, Effect monorepo | React 19, Node >=24, Python backend launcher | Keep application boundaries |

## Security blockers found before execution

1. SDK ACP client `request_permission` automatically chooses `options[0].option_id`, falling back to `allow_once`. Harish Code currently places allow-once first. Changing option order is not a reliable fix: an external client can choose an allow option by kind. The connection needs a trusted approval bridge or a fail-closed local mediator. Every action requiring review must wait for the user's actual decision, including child tools, cancellation and reconnects.
2. SDK native conversation defaults to `NeverConfirm()` and no per-run budget. Remote execution must explicitly establish confirmation, budget, authorized workspace and credential scope. A public metadata response cannot establish these.
3. Canvas direct-host quickstart warns that the agent can access the host filesystem. No direct-host quickstart, package install, Python environment setup, Docker launch, model run or cloud enrollment has been performed for this analysis.
4. Session API authentication uses `X-Session-API-Key` on protected `/api` routes, but `/server_info` is a root metadata endpoint. The probe deliberately sends no credential to this public route. A successful metadata probe does not verify credentials or authorize execution. Credentials must never appear in URLs, logs or client-visible error bodies.

## Work implemented locally

`packages/core/src/integrations/openhands/inspect.ts` is a read-only preparation module, not registered as an agent tool or backend. It validates an explicitly chosen origin, permits HTTPS or exact loopback HTTP, rejects embedded URL credentials/path/query/fragment, refuses redirects and cookies, bounds response bytes and time, validates a small metadata contract and redacts transport/server errors. It does not create conversations, approve actions, inspect files, send workspace contents or run providers. No UI or live endpoint is activated.

Offline tests cover origin restrictions, no credentials/body/redirect/cookies, malformed/oversized responses, abort propagation, stream cancellation and error privacy.

`approval.ts` adds a disabled adapter primitive with random one-use review IDs, session scoping, explicit allow-once/reject only, cancellation, deadline and connection-close rejection. A trusted client contract test carries these decisions through actual Harish Code ACP wire fixtures. This is not an authenticated UI transport: no external SDK reply is trusted, no review endpoint/UI has been built, and the primitive is not activated. Existing ACP wire tests use a local fake Harish Code server and test permission selection and session/model behavior. These are component tests, not a complete OpenHands workflow.

## Full workflow acceptance still required

- The inactive HC-owned review context now avoids sending permission requests to the external ACP client, waits for a shared HC server decision, rejects after a deadline and on cancellation. Foreign-session settlement/replay is regression-tested. No CLI flag/profile exposes this route yet. New guarded session creation, load/resume/fork and pre-prompt checks require an owner-bound workspace and guarded marker; extra MCP roots are refused. These are application checks, not filesystem containment. It does not force normally autoallowed operations to ask or establish an authenticated reviewing UI.
- Build a disabled-by-default Canvas connection profile and approval mediator with no automatic allow path. Test approve, deny, cancel, client disconnect, stale/replayed decisions, concurrent tools and child sessions.
- Test actual initialize, session creation, streamed prompt, model selection, safe file edits, tool errors, cancellation and cleanup against the pinned SDK/Canvas with a fake model and disposable workspace only.
- Keep the command argv as an array; do not use a shell string or automatically download the CLI. Resolve the intended Harish Code executable on each backend host.
- HC saved project approvals are evaluated after configured session rules. A blanket session `ask` alone therefore does not force review. Plugin permission hooks can also return allow. The local restrict-only `harishcode.openhands.requireReview` marker now forces non-denied results back to ask after those paths, and resolves live parent/fork ancestry even when descendant metadata is replaced. Guarded always replies apply once and do not save a grant. Owner-controlled marker lifecycle, execution-time workspace binding and a real authenticated reviewing UI are still unresolved. The marker is not an identity or sandbox boundary. `assertNotDenied` is a deliberately non-interactive check used by webfetch and new image output; guarded sessions block these paths rather than execute on ask. They need an approval-capable caller path before this integration can claim those tools work.
- Verify workspace identity and mounts, file boundaries, per-session state, secrets, process ownership, restart and timeout behavior before allowing real project access.
- For engine-inside-Harish-Code, implement explicit event translation and authenticated session lifecycle separately. Do not route OpenHands server responses into Harish Code as trusted instructions.
- No real-provider calls, payments, cloud deployment, production account changes or broad host filesystem access are covered by local integration preparation. Resolve the specific access/budget decision only when a verified execution plan needs it.
- Existing Harish Code quality work, full-build/native/Windows gaps and source branding work remain open in parallel. This document is not a declaration that the whole repository has been behaviorally audited.

## Sources

- https://github.com/OpenHands/OpenHands
- https://raw.githubusercontent.com/OpenHands/OpenHands/main/LICENSE
- https://github.com/OpenHands/software-agent-sdk
- https://raw.githubusercontent.com/OpenHands/software-agent-sdk/bf9cb742acae7265d83b29f2f5967ec55ee69fa2/LICENSE
- https://raw.githubusercontent.com/OpenHands/software-agent-sdk/bf9cb742acae7265d83b29f2f5967ec55ee69fa2/openhands-sdk/openhands/sdk/agent/acp_agent.py
- https://raw.githubusercontent.com/OpenHands/software-agent-sdk/bf9cb742acae7265d83b29f2f5967ec55ee69fa2/openhands-agent-server/openhands/agent_server/models.py
- https://docs.openhands.dev/sdk/arch/overview
- https://docs.openhands.dev/sdk
- https://github.com/OpenHands/automation
- https://docs.openhands.dev/enterprise/enterprise-vs-oss


## Local checkpoint results, 15:55 IST

- All CLI ACP tests: 108 pass, 309 assertions, 16 files, using fixtures/disposable paths. Not a live Canvas/SDK connection.
- Core permission and integration helper tests: 124 pass, 1009 assertions, three files, memory database only.
- Source checks: core 958 files, core tests 790 files, CLI 983 files, zero reported type errors.
- Real Chrome production fragment helper regression passes; the original Happy DOM navigation mismatch remains documented separately.
- Initial integration fixture failures were retained, then corrected (wrong event field/start barrier and a missing hook fixture dependency). No failed test was deleted to produce these totals.

These counts are diagnostic evidence, not a denominator for full product acceptance. No model-provider request, existing user database access, deployment, real OpenHands server launch, paid activity or broad host access was part of this checkpoint.

## Execution-path audit, not a universal tool gate

Full caller ordering was inspected, not just permission call names:

| Path | Source ordering | Guarded integration status |
| --- | --- | --- |
| Read/search/edit/write/patch/shell | FileAccess or leaf permission checks before the relevant effect | Existing checks can force review; symlink/native containment not proven |
| Image generation | `image_generate` model permission assert occurs before paid `generate.image`; explicit output path also gets edit review | No live call tested. Background final new-file check is non-interactive; guarded blocking can reject output after approved generation, so do not enable this workflow yet |
| Web fetch | Initial URL assert then non-interactive per-request/redirect checks | Guarded non-interactive check now rejects instead of treating ask as allowed; redirect approval UX not complete |
| Subagent | Permission assert before child creation/prompt; child inherits session metadata/permissions | Live ancestor review check adds protection, not a budget or sandbox guarantee; background/recovery acceptance still pending |
| MCP | Tool/resource invocation assert precedes network call | Connection discovery/startup is a separate effect; client-supplied MCP configuration refused in guarded lifecycle |
| Todo | Explicit permission assert before result metadata | Fixture-only |
| Schedules | Registry/CodeMode forwards to schedule leaf. Mutation leaf now asserts create/pause/resume/delete after enabled/ownership checks, before service mutation | Focused direct+CodeMode deny/pending/cancel regression tested. Real scheduler recovery/background execution and authenticated UI still need acceptance |
| Session rename/move and worktree create | Local follow-up adds leaf Permission.assert before host effects, with caller session and exact operation input | Focused real-registry/CodeMode deny regressions pass; baseline fails without checks. Permission is not filesystem containment or cross-session authorization |
| Browser | Catalog visibility uses `browser` permission; execution selects desktop connection/tab and sends RPC | Visibility is not execution approval. Final per-action/URL review layer not established by this work; do not activate |
| CodeMode fetch | CodeModeWeb calls global fetch with timeout; registry catalog filtering is not per-request authorization | Strict marker is not universal egress control. Must disable or mediate before guarded connection activation |
| Main LLM/title/compaction/plugin hooks | Model request preparation and plugin hooks have their own effect paths | Tool approval is not spending permission. No real provider was called; provider choice/budget and plugin trust require separate verified controls |

A default-deny launch profile is not offered until these caller paths, authenticated UI presence/disconnect, cancellation/recovery, workspace binding and the actual pinned Canvas/SDK workflow are tested together. No new generic registry authorization was added: the repository's tool architecture leaves resolution and side-effect ordering with leaves. Root marker lifecycle is not yet immutable, although an already-pending guarded request remains one-time even if metadata changes before its reply.


### Schedule mutation repair, local follow-up at 16:01 IST

A new real-registry/CodeMode regression failed against the prior implementation: a rejecting permission service was never consulted, and schedule creation succeeded. The repair adds leaf approval for create, pause, resume and delete without adding a generic registry authorization layer. Listing stays read-only. Exact caller session, schedule resource and tool source accompany each request. Enabled-state and ownership checks happen first, so foreign schedules are not exposed through an approval prompt.

Focused tool tests: 10 pass, 48 assertions, including no mutation on denial, direct and CodeMode calls, pending review with no schedule until approval, and interrupted review leaving no future work. Source/test type checks remain clear. These tests use an in-memory schedule service and an injected permission service; no user schedule, model, timer process or provider was touched. This does not complete the guarded Canvas workflow or approve future scheduled model spend.
