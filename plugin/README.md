# redev-vite-plugin

Vite plugin for [Redev](../README.md). Injects `data-redev-*` attributes into every DOM-level JSX element at dev-server time so the browser overlay can identify which source file and component was clicked.

## What it does

- Parses every `.jsx` / `.tsx` file in your project with Babel
- Adds four attributes to every lowercase JSX element (`<div>`, `<button>`, `<h1>`, etc.):
  - `data-redev-file` — path relative to the Vite project root
  - `data-redev-line` — 1-indexed line number in the source file
  - `data-redev-column` — 0-indexed column
  - `data-redev-component` — name of the enclosing React component (function or class)
- Injects `<script src=".../redev/overlay.js">` into `index.html`
- Only runs during `vite dev` — production builds are untouched

## Install

```bash
npm install -D redev-vite-plugin
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import redev from 'redev-vite-plugin';

export default defineConfig({
  plugins: [
    redev({ backendUrl: 'http://localhost:5050' }),
    react(),
  ],
});
```

`redev()` must run **before** `@vitejs/plugin-react` — `enforce: 'pre'` is set on the plugin, so Vite orders it correctly, but if you have other pre-plugins, keep Redev first.

## Options

| Option | Default | What it does |
|---|---|---|
| `backendUrl` | `http://localhost:5050` | Where the Redev backend serves the overlay script. |
| `enabled` | `true` | Set false to disable the plugin without removing it from the config. |
| `include` | `null` | (Reserved for future use — currently transforms all `.jsx`/`.tsx`.) |
| `exclude` | `['**/node_modules/**']` | (Reserved for future use — `node_modules` is always skipped.) |

## What gets skipped

- Uppercase JSX elements (`<Button>`, `<MyComponent>`) — attributes go on the DOM element these render, not on the component tag itself.
- Fragments (`<>...</>` and `<React.Fragment>`).
- Files in `node_modules`.
- Elements that already have `data-redev-file` (idempotent).
- Non-JSX files.

## Verifying it works

Start Vite, open the browser dev tools, and inspect any element. You should see:

```html
<button
  class="btn"
  data-redev-file="src/components/Button.tsx"
  data-redev-line="42"
  data-redev-column="4"
  data-redev-component="Button"
>
```

If the attributes are missing, check that the plugin appears before `react()` in your config and that the file being inspected is a `.tsx`/`.jsx` file (not compiled JS from a library).
