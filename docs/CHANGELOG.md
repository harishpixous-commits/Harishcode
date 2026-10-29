# Changelog

All notable changes to the **Harish Code** distribution.
The application logic tracks upstream OpenCode `2.2.0`.

## 2.2.0 — Harish Code 1

### Identity

- Window title, application name, menu labels, user agent and executable
  metadata (`ProductName`, `FileDescription`, `CompanyName`) are *Harish Code*.
- Update channel pinned to `pixcode` so an upstream release cannot silently
  overwrite this build.
- Desktop and Start Menu shortcuts written as **Harish Code**; stale shortcuts
  pointing at the previous install removed; shell icon cache refreshed.

### Artwork

- New HC monogram replacing every OpenCode mark:
  - home-screen wordmark — was eight hard-coded letter paths, now a
    theme-adaptive `HARISH CODE` SVG `text` element
  - provider avatar in *Settings → Models* — was a square-in-square glyph, now
    the HC rounded-square outline mark in `currentColor`
  - About wordmark — was a `<symbol>`-per-letter `opencode` composition, now a
    static `HARISH CODE` wordmark
  - About decorative brush — was the Anomaly script, now a `HARISH CODE` plate
- Embedded `.ico`, window icons, favicons, Apple touch icons and tiles all
  regenerated from the HC artwork, including a heavier glyph tuned for 16–32 px.

### Copy

- 3,741 user-facing strings updated across every locale bundle.
- Inflected Nordic forms (`OpenCoden`, `OpenCodea`, `OpenCodes`) fixed in the
  Finnish, Danish and Swedish bundles — 19 strings across 7 files.
- Provider label in the model picker reads **Harish Code** instead of the
  upstream provider name. This is a display-only rewrite; the provider id and
  API are untouched, so model routing and free-tier access are unaffected.

### About page

- Credits now read *All written by harishpixous-commits* and link to
  <https://github.com/harishpixous-commits>.
- Website, publication and repository links point at
  <https://github.com/harishpixous-commits/Harishcode>.
- Removed the *Anomaly Innovations* trademark line and copyright; replaced with
  *Harish Code — a project by @Harish Innovations* and *© Harish Innovations*.
- Removed the "and 1055 others" contributor chip.

### Added

- **Refresh button on the model list.** *Settings → Models* now shows a refresh
  control next to each provider group header (including **Harish Code Free**).
  Clicking it re-queries the local server's model and provider catalog and then
  reloads the renderer, so models added behind the app's back — a new Ollama
  pull, a new remote model from an OpenAI-compatible endpoint — appear without
  restarting Harish Code. The icon spins while the catalog is fetched and
  respects `prefers-reduced-motion`.

### Fixed

- **Critical:** an over-broad rename had rewritten a destructuring import from
  `let{OpenCode:i}=await import(…)` to `let{Harish Code:i}`, which is invalid
  JavaScript. It surfaced as `SyntaxError: Unexpected identifier 'Code'` inside
  the desktop IPC handler and aborted startup with *"An error occurred while
  starting the local server"*. The destructuring name is now preserved.
- Asar header now uses the correct pickle field order and is space-padded, so
  the archive parses reliably.

### Verified

- All 646 main-process bundles pass `node --check` (0 failures).
- Application launches with no renderer console errors or warnings.
- Local server returns `200 OK` with 14 models; all free models listed.
- End-to-end reply confirmed from *Flint 40B Free* through the composer.

### Deliberately unchanged

- Internal RPC namespace (`OpenCode:()=>…`), provider ids (`opencode`,
  `opencode-go`), storage keys (`opencode.*.dat`) and log paths.
- Third-party provider names in *Settings → Providers* (*OpenCode Go*,
  *OpenCode Console*), which are real external services.
- The upstream MIT copyright notice, retained in `LICENSE` and `NOTICE` as the
  licence requires.
