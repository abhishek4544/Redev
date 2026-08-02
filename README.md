# 🥔 Redev

[![npm redev-cli](https://img.shields.io/npm/v/redev-cli.svg?label=redev-cli)](https://www.npmjs.com/package/redev-cli)
[![npm redev-vite-plugin](https://img.shields.io/npm/v/redev-vite-plugin.svg?label=redev-vite-plugin)](https://www.npmjs.com/package/redev-vite-plugin)
[![license](https://img.shields.io/npm/l/redev-cli.svg)](./cli/LICENSE)

**Click any element in your running dev app. Describe the change. Ship it — via Claude Code, into your actual source.**

Redev turns your Vite + React or Next.js dev server into an editable surface. Point at what's wrong, type what you want, and Claude Code makes the edit and reloads your browser. Everything runs locally.

---

## Quickstart

```bash
# In your Vite + React project
npm install -D redev-cli redev-vite-plugin
```

Add the plugin to `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import redev from 'redev-vite-plugin'

export default defineConfig({
  plugins: [redev(), react()],
})
```

Start your dev server and Redev:

```bash
npm run dev    # terminal 1 — your usual Vite server
npx redev      # terminal 2 — starts Redev backend + CLI
```

Open your app. Press **Cmd+Shift+E**. Click something. A panel appears — type your change, copy the command Redev generates, paste it in a fresh terminal (or into your existing Claude Code chat).

Claude Code edits the file. Your browser reloads. Your git diff is ready to commit.

### Next.js / Surgical

Use Redev's development proxy; it detects the app belonging to the current
project and injects the overlay without a Vite plugin or Next.js dependency:

```bash
# Run from Surgical after its Next server starts
npx redev-cli@latest

# Open the Redev proxy, not the original Next server
open http://localhost:5050
```

Press **Cmd+Shift+E**, then click an element. If multiple apps are running,
Redev shows a chooser rather than attaching to the wrong project. You can
override discovery with `npx redev-cli@latest --app http://localhost:3003`.

---

## Requirements

- Node 18+
- A Vite + React project (Vite 4 / 5 / 6 / 7 / 8)
- [Claude Code](https://claude.com/claude-code) installed and signed in

---

## How it works

1. **`redev-vite-plugin`** walks your JSX at dev time and injects `data-redev-file`, `data-redev-line`, `data-redev-component` on every element.
2. **The overlay** (served by the CLI's local backend) captures your click and reads those attributes.
3. **The panel** collects your prompt and generates a `claude -p ...` command (or a chat-friendly prompt) referencing a drop-box file at `.redev/pending.json`.
4. **Claude Code** (either an auto-spawned subprocess or your existing session) reads the pending file, edits your source, and writes `.redev/completed.json`.
5. **The backend** watches for the completed file and reloads your browser.

Nothing runs on Redev servers. There is no Redev cloud.

---

## Repo layout

| Path | What it is |
|---|---|
| `cli/` | `redev-cli` npm package — Ink TUI + bundled Express/WS backend |
| `plugin/` | `redev-vite-plugin` npm package — Babel-based JSX transformer |
| `backend/` | Standalone dev backend (mirror of what CLI bundles) |
| `website/` | The Next.js + React + TypeScript landing page |

---

## Development

```bash
git clone https://github.com/abhishek4544/Redev.git
cd Redev/potatoo-dev

# Backend (dev version — hot-reloadable)
cd backend && npm install && npm run dev

# CLI (in another terminal)
cd cli && npm install && npm run dev

# Website
cd website && npm install && npm run dev
```

---

## Roadmap

**Shipped**
- Click-to-select overlay (Cmd+Shift+E)
- Drop-box agent handoff (`.redev/pending.json` → `.redev/completed.json`)
- Auto-spawn of Claude Code (CLI-side)
- Copy-paste terminal command **and** Claude Code chat prompt
- Auto-port fallback if 5050/3001 are taken

**Next**
- MCP server so this Claude Code session picks up requests directly (no copy-paste)
- Diff preview + approval gate before edits apply
- Next.js support
- Automated tests + GitHub Actions CI

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

MIT — see [cli/LICENSE](./cli/LICENSE) and [plugin/LICENSE](./plugin/LICENSE).
