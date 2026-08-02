import { createElement } from 'react';

/**
 * <RedevScript /> — drop into your Next.js root layout to enable
 * click-to-edit against a running `npx redev-cli` instance.
 *
 * Renders nothing in production. Safe in Server Components.
 *
 * @param {{ port?: number }} props
 */
export function RedevScript({ port = 5050 } = {}) {
  if (process.env.NODE_ENV !== 'development') return null;
  return createElement('script', {
    async: true,
    src: `http://localhost:${port}/redev/overlay.js`,
  });
}
