import express from 'express';
import cors from 'cors';
import net from 'net';
import { RedevWebSocketServer } from './websocket/server.js';
import { OVERLAY_SCRIPT } from './overlay-server/overlay-script.js';
import { FileService } from './services/FileService.js';
import { ChangeHandler } from './services/ChangeHandler.js';
import { AgentSpawner } from './services/AgentSpawner.js';
import { makeAppProxy } from './proxy.js';
import { discoverLocalApps } from './discovery.js';

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });
}

async function pickPort(preferred, log) {
  if (await isPortFree(preferred)) return preferred;
  log(`[Redev] Port ${preferred} in use — picking a free port automatically`);
  for (let p = preferred + 1; p < preferred + 50; p++) {
    if (await isPortFree(p)) return p;
  }
  return 0;
}

export async function startRedevServer({
  httpPort: preferredHttp = Number(process.env.REDEV_HTTP_PORT) || 5050,
  wsPort: preferredWs = Number(process.env.REDEV_WS_PORT) || 3001,
  projectRoot = process.env.REDEV_PROJECT_ROOT || process.cwd(),
  proxyTarget = process.env.REDEV_PROXY_TARGET || null, // e.g. 'http://localhost:5173' — null means auto-detect
  proxyMode = process.env.REDEV_PROXY_MODE !== '0', // default ON, disable with REDEV_PROXY_MODE=0
  log = console.log,
} = {}) {
  const httpPort = await pickPort(preferredHttp, log);
  const wsPort = await pickPort(preferredWs, log);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), projectRoot, mode: proxyMode ? 'proxy' : 'standalone', httpPort, wsPort });
  });

  app.get('/redev/overlay.js', (req, res) => {
    res.type('application/javascript');
    const script = OVERLAY_SCRIPT.replace(
      "'ws://localhost:3001?client=browser'",
      `'ws://localhost:${wsPort}?client=browser'`
    );
    res.send(script);
  });

  app.get('/redev/inject.html', (req, res) => {
    res.type('text/html');
    res.send(`<script src="http://localhost:${httpPort}/redev/overlay.js"></script>`);
  });

  const fileService = new FileService(projectRoot);
  const agentSpawner = new AgentSpawner({ projectRoot });
  const wsServer = new RedevWebSocketServer(wsPort);
  wsServer.start();
  const changeHandler = new ChangeHandler({ wsServer, fileService, agentSpawner });
  changeHandler.register();

  // MCP-facing endpoints
  app.get('/mcp/pending', (req, res) => {
    const req_ = changeHandler.activeRequest;
    if (!req_) return res.json({ pending: null });
    res.json({
      pending: {
        request_id: req_.id,
        element: req_.element,
        prompt: req_.prompt,
        instruction: req_.instruction,
        project_root: projectRoot,
      },
    });
  });
  app.post('/mcp/apply', (req, res) => {
    changeHandler.completeFromMcp({ summary: req.body?.summary || 'edit applied', files_edited: req.body?.files_edited || [] })
      .then((r) => res.json(r)).catch((e) => res.status(500).json({ error: e.message }));
  });
  app.post('/mcp/error', (req, res) => {
    changeHandler.failFromMcp(req.body?.error || 'unspecified error')
      .then((r) => res.json(r)).catch((e) => res.status(500).json({ error: e.message }));
  });

  // PROXY: forward everything else to the user's dev server.
  // Must be LAST — after all /redev, /mcp, /api routes are registered.
  let resolvedProxyTarget = null;
  let sharedProxy = null;
  if (proxyMode) {
    if (!proxyTarget) {
      const discovery = await discoverLocalApps({ projectRoot });
      if (discovery.recommendation) {
        resolvedProxyTarget = discovery.recommendation.baseUrl;
        log(`[Redev] Auto-selected ${discovery.recommendation.framework} at ${resolvedProxyTarget} (${discovery.recommendation.confidence}% confidence).`);
      } else if (discovery.candidates.length > 0) {
        log(`[Redev] Multiple or low-confidence local apps found. Run \`npx redev --app <URL>\` to choose one.`);
      } else {
        log(`[Redev] No project-matched dev server detected. Start your app, then run \`npx redev\` again or pass \`--app <URL>\`.`);
      }
    } else {
      resolvedProxyTarget = proxyTarget;
    }

    if (resolvedProxyTarget) {
      sharedProxy = makeAppProxy({ target: resolvedProxyTarget, overlayPort: httpPort });
      app.use('/', sharedProxy);
    }
  }

  const httpServer = app.listen(httpPort, () => {
    const scriptTag = `<script async src="http://localhost:${httpPort}/redev/overlay.js"></script>`;
    log('');
    log(`   ┌──────────────────────────────────────────────────────────────┐`);
    log(`   │  🥔 Redev is running                                         │`);
    log(`   └──────────────────────────────────────────────────────────────┘`);
    log('');
    log(`   Add this ONE line to your app (root layout / index.html):`);
    log('');
    log(`     ${scriptTag}`);
    log('');
    log(`   Then open YOUR dev URL as usual and press Cmd+Shift+E to click-to-edit.`);
    if (proxyMode && resolvedProxyTarget) {
      log('');
      log(`   (Optional zero-config proxy: http://localhost:${httpPort} → ${resolvedProxyTarget})`);
    }
    log('');
  });

  // Forward user dev-server WS upgrades (e.g. Vite HMR) through the same proxy instance.
  if (sharedProxy && typeof sharedProxy.upgrade === 'function') {
    httpServer.on('upgrade', (req, socket, head) => {
      sharedProxy.upgrade(req, socket, head);
    });
  }

  return {
    httpServer,
    wsServer,
    httpPort,
    wsPort,
    proxyTarget: resolvedProxyTarget,
    stop() {
      wsServer.stop();
      httpServer.close();
    },
  };
}
