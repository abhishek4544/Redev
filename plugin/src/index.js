import path from 'path';
import { transformJsx } from './jsx-transformer.js';
import { injectOverlayIntoHtml } from './html-injector.js';

const JSX_EXTENSIONS = new Set(['.jsx', '.tsx']);
const DEFAULT_BACKEND = 'http://localhost:5050';

export default function redevVitePlugin(userOptions = {}) {
  const options = {
    backendUrl: userOptions.backendUrl || DEFAULT_BACKEND,
    include: userOptions.include || null,
    exclude: userOptions.exclude || ['**/node_modules/**'],
    enabled: userOptions.enabled !== false,
  };

  let projectRoot = process.cwd();

  function shouldTransform(id) {
    if (!options.enabled) return false;
    const clean = id.split('?')[0];
    const ext = path.extname(clean);
    if (!JSX_EXTENSIONS.has(ext)) return false;
    if (clean.includes('node_modules')) return false;
    return true;
  }

  function toRelativePath(id) {
    const clean = id.split('?')[0];
    const rel = path.relative(projectRoot, clean);
    return rel.split(path.sep).join('/');
  }

  return {
    name: 'redev',
    enforce: 'pre',
    apply: 'serve',

    configResolved(config) {
      projectRoot = config.root;
      if (options.enabled) {
        console.log(`[redev] enabled — backend at ${options.backendUrl}`);
      }
    },

    transform(code, id) {
      if (!shouldTransform(id)) return null;
      const relativePath = toRelativePath(id);
      const result = transformJsx(code, relativePath);
      if (!result) return null;
      return result;
    },

    transformIndexHtml(html) {
      if (!options.enabled) return html;
      return injectOverlayIntoHtml(html, options.backendUrl);
    },
  };
}

export { redevVitePlugin };
