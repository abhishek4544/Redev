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

## Requirements

- Node 18+
- A Vite + React project
- [Claude Code](https://claude.com/claude-code) installed and signed in

## License

MIT
