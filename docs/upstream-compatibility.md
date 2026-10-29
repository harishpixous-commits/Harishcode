# Upstream compatibility audit, 2026-10-29

Baseline: Harish Code branch `source-fixes/2026-10-29-quality-safety`, published dependency repair `2fea6c8`; upstream `anomalyco/opencode` dev `1341387981e7de693198080fbed24d6ec3e4343b`. Release v2.2.1 is a comparison lead, not proof a feature is missing. No common commit ancestry has been established: the Harish Code repository has a short independent source-release history.

## Verified distinctions

| Area | Finding | Evidence and limit |
| --- | --- | --- |
| Dependency installation | Broken external package identities repaired, exact pins and hashes retained | Fresh frozen installation with lifecycle scripts disabled succeeds. Four stale patch warnings remain. Default lifecycle installation and native runtime are not verified. |
| Coding contracts and mode permissions | Harish Code custom changes retained | Focused core 158 tests pass. Composition and policy tests are not proof of model compliance or OS containment. |
| Goal continuation | Already present and registered, not a missing feature | Goal watchdog 5 tests pass against stubbed domains, no live model execution. |
| Experimental image generation | Already present, opt-in, registered | Source correspondence only. No provider calls or spending tested. |
| Model picker | Existing model controller matches upstream after branding normalization | Four model helper tests pass. Full picker visual behavior not verified. |
| Fork/import media blobs | Already present, not a newly imported fix | Projector 30 and prompt/import 50 tests pass separately using test storage. Real user storage untouched. |
| Composer attachment failure reporting | Genuine upstream gap repaired from #59546 | Original 5 tests fail; repaired 5 pass. Simulated store failure, not a real disk-full UI test. |
| Markdown fragment links | Genuine upstream gap repaired from #59550 | Added delegated click helper and cleanup. Unit and isolated browser checks; integrated app rendering still unverified. |
| App declaration file | Upstream symlink had become plain path text | Portable declaration import repairs two parse errors; app checks 1876 files without errors. |
| Public assets | 42 upstream symlink placeholders were plain path text | Restored copies of existing contained Harish Code source assets, hash/signature regression. Does not replace or redesign the source branding. |
| Existing source branding | Residual upstream artwork remains in some own source assets | Pixel review shows OpenCode wording in social cards and inherited geometric icons. This is a known branding gap, not declared fully rebranded. Harish Code wordmark/spinner customizations preserved. |
| AI provider exports | Breaking release export layout already reflected in local source | Nested Bedrock/Vertex public entries present; normalized AI tree matches upstream. No provider account compatibility tested. |
| Session busy time / inbox ordering | New upstream migration and dependent UI still not imported | Needs compatibility review; no new migration activated. |

## Module coverage

This is a source inventory across every top-level package/service group, not behavioral acceptance. Counts compare tracked files with limited branding and CRLF normalization. Equal bytes do not prove correct behavior; different files are not necessarily missing functionality. Branding, custom changes, generated files, and ordinary fixes all contribute. Untracked Harish Code additions are not counted below. Cache/database artifacts in upstream are excluded from adaptation.

| Module | Common files | Normalized equal | Different | Upstream-only paths | Behavior |
| --- | ---: | ---: | ---: | ---: | --- |
| (root and operations) | 286 | 277 | 9 | 26 | Not fully tested |
| packages/ai | 765 | 765 | 0 | 0 | Not fully tested |
| packages/app | 975 | 871 | 104 | 8 | Not fully tested |
| packages/cli | 213 | 210 | 3 | 0 | Not fully tested |
| packages/client | 72 | 69 | 3 | 0 | Not fully tested |
| packages/codemode | 102 | 102 | 0 | 0 | Not fully tested |
| packages/console | 212 | 174 | 38 | 0 | Not fully tested |
| packages/core | 842 | 816 | 26 | 1 | Not fully tested |
| packages/desktop | 361 | 358 | 3 | 0 | Not fully tested |
| packages/effect-drizzle-sqlite | 2 | 2 | 0 | 0 | Not fully tested |
| packages/function | 7 | 7 | 0 | 0 | Not fully tested |
| packages/gui-plugins | 878 | 865 | 13 | 0 | Not fully tested |
| packages/http-recorder | 30 | 30 | 0 | 0 | Not fully tested |
| packages/httpapi-codegen | 16 | 16 | 0 | 0 | Not fully tested |
| packages/identity | 6 | 6 | 0 | 0 | Not fully tested |
| packages/latex | 16 | 16 | 0 | 0 | Not fully tested |
| packages/merman | 91 | 90 | 1 | 0 | Not fully tested |
| packages/patchmark | 19 | 19 | 0 | 0 | Not fully tested |
| packages/plugin | 102 | 101 | 1 | 0 | Not fully tested |
| packages/plugin-browser | 17 | 17 | 0 | 0 | Not fully tested |
| packages/plugins | 99 | 99 | 0 | 0 | Not fully tested |
| packages/posts | 16 | 16 | 0 | 0 | Not fully tested |
| packages/process-daemon | 58 | 58 | 0 | 0 | Not fully tested |
| packages/protocol | 55 | 54 | 1 | 0 | Not fully tested |
| packages/schema | 131 | 130 | 1 | 0 | Not fully tested |
| packages/script | 7 | 7 | 0 | 0 | Not fully tested |
| packages/sdk | 34 | 34 | 0 | 0 | Not fully tested |
| packages/server | 105 | 105 | 0 | 0 | Not fully tested |
| packages/session-ui | 214 | 207 | 7 | 0 | Not fully tested |
| packages/simulation | 28 | 28 | 0 | 0 | Not fully tested |
| packages/stats | 130 | 111 | 19 | 0 | Not fully tested |
| packages/stories | 32 | 32 | 0 | 0 | Not fully tested |
| packages/theme | 18 | 18 | 0 | 0 | Not fully tested |
| packages/tui | 541 | 536 | 5 | 0 | Not fully tested |
| packages/ui | 1710 | 1700 | 10 | 1 | Not fully tested |
| packages/util | 71 | 71 | 0 | 0 | Not fully tested |
| packages/web | 649 | 628 | 21 | 0 | Not fully tested |
| sdks/vscode | 16 | 16 | 0 | 0 | Not fully tested |
| services/README.md | 1 | 1 | 0 | 0 | Not fully tested |
| services/changelog | 16 | 14 | 2 | 7 | Not fully tested |
| services/files | 6 | 6 | 0 | 0 | Not fully tested |
| services/update | 11 | 10 | 1 | 0 | Not fully tested |
| services/www | 117 | 114 | 3 | 0 | Not fully tested |

## Open acceptance and next work

- Full suite, build, lint, Windows, native PTY and integrated live GUI are not accepted.
- Existing native-write containment and startup failures remain open reference obligations.
- Review attachment success/retry/cancel paths, Markdown duplicate anchors and full app scrolling, inherited artwork, session timing dependencies, and stale patches without broad version substitution.
- Preserve Harish Code customizations, MIT copyright/permission notices and third-party package identities. Do not import upstream cache files, CI/deploy workflows or provider removals blindly.
- Distinct new features require owner approval; source presence must be checked before proposing one. No claim that Harish Code is always ahead of upstream is established by this audit.

## Primary sources

- https://github.com/anomalyco/opencode
- https://github.com/anomalyco/opencode/releases/tag/v2.2.1
- https://raw.githubusercontent.com/anomalyco/opencode/dev/LICENSE
- https://registry.npmjs.org/%40opencode-ai%2Fpty/0.3.1
- https://github.com/anomalyco/ghostty-web/commit/e91e38a9ceb13c566ddfa15185a9393849f712a9
