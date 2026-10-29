# Build tooling

These are the exact scripts used to produce the Harish Code build from an
upstream OpenCode `2.2.0` application archive. They operate on a **directory**
that has already been unpacked from `app.asar`.

Run them in order, from the repository root, with the unpacked tree at `app/`.

| Step | Script | What it does |
| --- | --- | --- |
| — | `make-logo.py` | Generates the HC monogram, tiles and lockup from the source artwork |
| — | `make-icons.py` | Renders every icon size (16→1024) and the `.ico` |
| 01 | `01-rebrand-strings.js` | Rebrands product identity strings and locale copy |
| 02 | `02-fix-locale-inflections.js` | Fixes inflected Nordic forms (`OpenCoden`, `OpenCodea`, …) |
| 03 | `03-patch-wordmark.js` | Replaces the home-screen `opencode` letter paths with the HARISH CODE wordmark |
| 04 | `04-patch-provider-icon.js` | Replaces the provider avatar glyph with the HC mark |
| 05 | `05-patch-about-wordmark.js` | Replaces the About page symbol-letter wordmark |
| 06 | `06-patch-about-credits.js` | Rewrites About credits, links, trademark and copyright |
| — | `asar-tool.js` | Packs the tree back into `app.asar` |

## Packing

```bash
node build/asar-tool.js pack <original-or-previous>/app.asar app dist/app.asar
```

The packer preserves the original header's entries, `unpacked` flags and links,
rewrites offsets and drops stale per-file integrity hashes.

## Important

`01-rebrand-strings.js` **must not** rewrite these, or the app breaks:

- RPC namespace exports — `OpenCode:()=>…`, `{OpenCode:i}`, `module.OpenCode.make`
- provider ids — `opencode`, `opencode-go`
- storage keys — `opencode.global.dat`, `opencode.window`, `opencode.draft.*`
- the `@opencode/client/…` import paths

An earlier over-broad pass rewrote `let{OpenCode:i}=await import(…)` into
`let{Harish Code:i}`, which is invalid JavaScript and crashed startup with
`SyntaxError: Unexpected identifier 'Code'`. The scripts here are scoped to
avoid that; keep the exclusion list intact if you edit them.

## Verifying a build

```bash
# every main-process bundle must parse
for f in app/out/main/*.js app/out/main/chunks/*.js; do node --check "$f" || echo "FAIL $f"; done
```

Then launch the packaged app and confirm *Settings → About* and the
new-session screen both render the Harish Code branding.
