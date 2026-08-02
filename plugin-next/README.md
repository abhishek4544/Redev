# redev-nextjs

Next.js companion for [`redev-cli`](https://www.npmjs.com/package/redev-cli) — click any element in your running Next app, describe the change, ship it.

## Install

```bash
npm install --save-dev redev-nextjs
```

## Use

In `app/layout.tsx` (App Router) or `pages/_app.tsx` (Pages Router):

```tsx
import { RedevScript } from 'redev-nextjs';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <RedevScript />
      </body>
    </html>
  );
}
```

Then, in a separate terminal:

```bash
npx redev-cli
```

Open your normal dev URL (`http://localhost:3000`), press **Cmd+Shift+E**, and click any element.

## What it does

- Renders `<script async src="http://localhost:5050/redev/overlay.js" />` **in development only**.
- Returns `null` in production, so it never ships to your users.
- Server-Component safe (no hooks, no client bundle).

## Options

```tsx
<RedevScript port={5051} />
```

Change `port` if `redev-cli` reports it picked a different port (e.g. 5050 was already in use).

## License

MIT
