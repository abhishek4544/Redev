# Contributing to Redev

Thanks for your interest. Redev is early — small PRs, clear reports, and honest bug repros all help.

## Ground rules

- **File an issue before a large PR.** Small typo/README fixes: go direct.
- **Keep changes focused.** One PR, one concern. Refactors welcome but ship separately from features.
- **No new dependencies without a note in the PR** explaining why.
- Be kind. There's no code of conduct doc yet, but the vibe is: help others get unstuck.

## Local setup

```bash
git clone https://github.com/abhishek4544/Redev.git
cd Redev/potatoo-dev

# Install all subprojects
(cd backend && npm install)
(cd cli && npm install)
(cd plugin && npm install)
(cd frontend && npm install)
```

## Running end-to-end for development

Three terminal tabs:

```bash
# 1. Dev backend (hot-reloadable — separate from CLI's bundled server)
cd backend && npm run dev

# 2. Example React app
cd frontend && npm run dev

# 3. Ink CLI
cd cli && npm run dev
```

Open `http://localhost:5173` (Vite's default), press **Cmd+Shift+E**, click something.

The `backend/` and `cli/src/server/` directories currently have separate copies of the same server code. When you change one, mirror to the other before publishing.

## Making a release

1. Bump the version in `cli/package.json` and/or `plugin/package.json`.
2. Add a changelog line to the top of the relevant `README.md`.
3. `cd cli && npm publish` (or `cd plugin && npm publish`).
4. Requires `npm login` and 2FA.

## Areas we'd love PRs in

- Next.js support (currently Vite + React only)
- Automated tests (none exist yet — pick any layer)
- MCP server (`cli/src/server/mcp/`)
- Better error messages
- Documentation site improvements (`website/`)

## Reporting bugs

Please include:
- OS + Node version
- Vite version + React version
- Full CLI output including the `[Redev]` and `[AgentSpawner]` lines
- What you clicked, what you typed, what you expected

Open at https://github.com/abhishek4544/Redev/issues.
