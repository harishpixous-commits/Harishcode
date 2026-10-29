<p align="center">
  <a href="https://github.com/harishpixous-commits/Harishcode">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="Harish Code logo">
    </picture>
  </a>
</p>

<p align="center">The open source AI coding agent.</p>

<p align="center">
  <a href="https://github.com/harishpixous-commits/Harishcode/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/github/license/harishpixous-commits/Harishcode?style=flat-square" /></a>
  <a href="https://github.com/harishpixous-commits/Harishcode/stargazers"><img alt="Stars" src="https://img.shields.io/github/stars/harishpixous-commits/Harishcode?style=flat-square" /></a>
  <a href="https://github.com/harishpixous-commits/Harishcode/actions/workflows/check.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/harishpixous-commits/Harishcode/check.yml?style=flat-square&branch=main" /></a>
  <a href="https://github.com/harishpixous-commits/Harishcode/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/harishpixous-commits/Harishcode?style=flat-square" /></a>
</p>

---

**Harish Code** is a terminal-first AI coding agent with a native desktop app. It runs locally, talks to the model providers you choose, and edits your repository the way a careful engineer would: reading context, proposing diffs, running commands, and reporting back.

- **Two modes, one keystroke** — `build` for full-access work, `plan` for read-only exploration.
- **Bring your own model** — Anthropic, OpenAI, Google, OpenRouter, Bedrock, Vertex, Groq, or any OpenAI-compatible endpoint.
- **Free tier included** — the hosted gateway ships a rotating set of free models, so you can start without a key.
- **Terminal UI and desktop app** — the same core, driven by a keyboard-first TUI or a frameless desktop shell.
- **Local-first** — sessions, credentials and project state stay on your machine.

---

### Installation

```bash
# Clone and run from source
git clone https://github.com/harishpixous-commits/Harishcode.git
cd Harishcode
bun install
bun run dev
```

`Harish Code` requires [Bun](https://bun.sh) `1.4.4` or newer. Once a release is published, the CLI installs globally as:

```bash
npm i -g @harishcode/cli@latest   # or bun / pnpm / yarn
```

The install script places binaries in `$HOME/.harishcode/bin`.

### Desktop App

The desktop shell lives in [`packages/desktop`](packages/desktop) and wraps the same core in a native window.

```bash
bun run dev:desktop
```

Build installers with `bun run --cwd packages/desktop build`.

| Platform              | Artifact                            |
| --------------------- | ----------------------------------- |
| Windows               | `.exe` (NSIS)                       |
| macOS (Apple Silicon) | `harishcode-desktop-mac-arm64.dmg`  |
| macOS (Intel)         | `harishcode-desktop-mac-x64.dmg`    |
| Linux                 | `.deb`, `.rpm`, `.AppImage`         |

### Agents

Two agents ship in the box; switch between them with `Tab`.

- **build** — default, full-access agent for development work.
- **plan** — read-only agent for analysis and code exploration.
  - Denies file edits by default.
  - Asks permission before running shell commands.
  - Ideal for exploring unfamiliar codebases or planning a change.

A **general** subagent handles complex searches and multi-step tasks. It runs internally and is invoked with `@general` in a message.

### Repository layout

This is a Bun workspace monorepo. The pieces that matter most:

| Path                   | Package                | What it does                                              |
| ---------------------- | ---------------------- | --------------------------------------------------------- |
| `packages/cli`         | `@harishcode/cli`      | Entry point, argument parsing, install/update flows        |
| `packages/tui`         | `@harishcode/tui`      | Terminal interface                                        |
| `packages/desktop`     | `@harishcode/desktop`  | Electron desktop shell                                    |
| `packages/core`        | `@harishcode/core`     | Sessions, tools, permissions, providers, storage           |
| `packages/ai`          | `@harishcode/ai`       | Provider adapters and streaming                            |
| `packages/server`      | `@harishcode/server`   | Local HTTP API used by every client                        |
| `packages/protocol`    | `@harishcode/protocol` | Shared request/response schemas                            |
| `packages/ui`          | `@harishcode/ui`       | Shared components, icons, theme primitives                 |
| `packages/sdk`         | `@harishcode/sdk`      | Generated client for the local server                      |

### Development

```bash
bun install            # install the workspace
bun run dev            # run the CLI from source
bun run dev:desktop    # run the desktop app
bun run typecheck      # typecheck every package
bun run check          # lint + typecheck
```

Each package exposes its own `test` script; run one workspace at a time:

```bash
bun run --cwd packages/core test
```

See [`AGENTS.md`](AGENTS.md) for the conventions this codebase follows.

### Documentation

Configuration, provider setup and the plugin API are documented in [`packages/core/src/plugin/skill/`](packages/core/src/plugin/skill) and inline with the code.

### Contributing

Patches are welcome. Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request, and run `bun run check` locally first.

### Security

Report vulnerabilities privately — see [`SECURITY.md`](SECURITY.md).

### License

[MIT](LICENSE) © Harish Innovations. Built and maintained by [@harishpixous-commits](https://github.com/harishpixous-commits).

---

<p align="center">
  <a href="https://github.com/harishpixous-commits">GitHub</a> ·
  <a href="https://github.com/harishpixous-commits/Harishcode/issues">Issues</a> ·
  <a href="https://github.com/harishpixous-commits/Harishcode/discussions">Discussions</a>
</p>
