# create-redev

One-command installer for [redev](https://github.com/abhishek4544/Redev). Detects your framework, installs the right packages, and wires up the overlay in your source.

## Use

From your project root:

```bash
npx create-redev@latest
```

That's it. It will:

1. Detect your framework from `package.json` (Next.js, Vite, or fall back to manual)
2. Detect your package manager (npm / pnpm / yarn / bun) from lockfiles
3. Install `redev-cli` + the right companion (`redev-nextjs` or `redev-vite-plugin`)
4. Modify the appropriate file:
   - **Next.js** → adds `<RedevScript />` to `app/layout.tsx`
   - **Vite** → adds `redev()` to `vite.config.{js,ts}`
   - **Other** → prints the raw `<script>` tag to paste

Then in two terminal tabs:

```bash
npm run dev        # tab 1
npx redev-cli      # tab 2
```

Open your app and press **Cmd+Shift+E**.

## Flags

```bash
npx create-redev@latest --next         # force Next.js path
npx create-redev@latest --vite         # force Vite path
npx create-redev@latest --manual       # install redev-cli only, print script tag
npx create-redev@latest --no-edit      # install packages but skip source edits
```

## What if the file edit fails?

The edits are regex-based and target the shape of default framework templates. If your `app/layout.tsx` or `vite.config.js` has an unusual shape, the tool falls back to printing the exact snippet for you to paste, and continues installing the packages. Nothing is destructive.

## License

MIT
