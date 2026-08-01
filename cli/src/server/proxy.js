import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';

/**
 * Build a proxy middleware that forwards to the user's dev server and injects
 * the Redev overlay script into HTML responses.
 *
 * @param {object} opts
 * @param {string} opts.target        e.g. 'http://localhost:5173'
 * @param {number} opts.overlayPort   port the overlay script is served from
 */
export function makeAppProxy({ target, overlayPort }) {
  const overlayTag = `<script async src="http://localhost:${overlayPort}/redev/overlay.js"></script>`;

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true, // forward user's dev-server WebSockets (HMR)
    selfHandleResponse: true, // so we can rewrite HTML
    on: {
      proxyRes: responseInterceptor(async (buffer, proxyRes) => {
        const ctype = proxyRes.headers['content-type'] || '';
        if (!ctype.includes('text/html')) return buffer;
        const html = buffer.toString('utf8');
        if (html.includes('data-redev-overlay')) return html; // already injected
        const tag = overlayTag.replace('<script ', '<script data-redev-overlay ');
        // Prefer just-before </head>; fallback to just-after <body>; fallback to end
        if (html.includes('</head>')) return html.replace('</head>', `${tag}</head>`);
        if (html.match(/<body[^>]*>/)) return html.replace(/(<body[^>]*>)/, `$1${tag}`);
        return html + tag;
      }),
      error: (err, req, res) => {
        // On WS upgrade failure, `res` is a Socket (no writeHead). Just destroy it.
        if (!res || typeof res.writeHead !== 'function') {
          try { res?.destroy?.(); } catch {}
          return;
        }
        if (res.headersSent) return;
        res.writeHead(502, { 'content-type': 'text/plain' });
        res.end(
          `[Redev proxy] Could not reach your dev server at ${target}.\n\n` +
          `Is it running? Start it in another terminal, then reload this page.\n\n` +
          `Detail: ${err.message}`
        );
      },
    },
  });
}

/**
 * Try common dev-server ports and return the first one that responds.
 * Returns null if none respond.
 */
export async function detectDevServer(candidates = [5173, 3000, 4321, 4200, 8080, 3001]) {
  for (const port of candidates) {
    if (port === Number(process.env.REDEV_HTTP_PORT) || port === Number(process.env.REDEV_WS_PORT)) continue;
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(500) });
      if (res.status < 500) return port;
    } catch {}
  }
  return null;
}
