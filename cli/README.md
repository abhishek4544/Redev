# redev-cli

Click any element in your dev app. Describe the change. Ship it — via Claude Code, into your actual source.

```bash
npm install -D redev-cli redev-vite-plugin
```

## Setup

Add the Vite plugin so DOM clicks can map back to source files:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import redev from 'redev-vite-plugin';

export default defineConfig({
  plugins: [react(), redev()],
});
```

Then run:

```bash
npx redev
```

Open your app, press `Cmd+Shift+E`, and click anything.

## How it works

1. **Click** an element in your browser overlay
2. **Describe** the change ("make the padding bigger")
3. **Copy** the generated command into your terminal
4. **Done** — Claude Code edits the file, browser reloads, git diff is ready

Everything runs locally. Nothing is sent to Redev servers.

## Next.js (including Surgical on port 3003)

Redev automatically identifies the development server belonging to the project
where you run it, then injects the overlay through a local proxy. This works
with Next.js and requires no Vite plugin or Next component package. If multiple
local apps are plausible, Redev shows a one-line chooser instead of guessing.

```bash
# terminal 1
npm run dev -- --port 3003

# terminal 2
npx redev
```

Open **http://localhost:5050** (the Redev proxy), rather than the bare Next
server at port 3003. The proxy injects the overlay automatically. Press
`Cmd+Shift+E`, then click an element.

If port 5050 is occupied, Redev prints the replacement port; open that port
instead. Use an explicit app URL only when you want to override discovery:

```bash
npx redev-cli@latest --app http://localhost:3003
```

### CLI options

```bash
npx redev --app http://localhost:3003
npx redev-cli@latest --port 5051 --ws-port 3002
npx redev-cli@latest doctor
```

`npx redev doctor` lists every browser app Redev found, its detected framework,
and why it was or was not chosen automatically.

After a confirmed selection, Redev stores a project-local identity in
`.redev/session.json`. It remembers framework, document fingerprint, and
project process—not a port number. Redev reuses it only when exactly one live
app still matches; otherwise it shows the app chooser again.

## Requirements

- Node 18+
- A Vite + React project
- [Claude Code](https://claude.com/claude-code) installed and signed in

## License

MIT
