import express from 'express';
import cors from 'cors';
import net from 'net';
import { RedevWebSocketServer } from './websocket/server.js';
import { OVERLAY_SCRIPT } from './overlay-server/overlay-script.js';
import { FileService } from './services/FileService.js';
import { ChangeHandler } from './services/ChangeHandler.js';
import { AgentSpawner } from './services/AgentSpawner.js';

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
  // OS-assigned fallback
  return 0;
}

export async function startRedevServer({
  httpPort: preferredHttp = Number(process.env.REDEV_HTTP_PORT) || 5050,
  wsPort: preferredWs = Number(process.env.REDEV_WS_PORT) || 3001,
  projectRoot = process.env.REDEV_PROJECT_ROOT || process.cwd(),
  log = console.log,
} = {}) {
  const httpPort = await pickPort(preferredHttp, log);
  const wsPort = await pickPort(preferredWs, log);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString(), projectRoot, mode: 'drop-box', httpPort, wsPort });
  });

  app.get('/redev/overlay.js', (req, res) => {
    res.type('application/javascript');
    // inject actual wsPort so overlay connects to correct backend
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

  const httpServer = app.listen(httpPort, () => {
    log(`[Redev] HTTP server:  http://localhost:${httpPort}`);
    log(`[Redev] Overlay:      http://localhost:${httpPort}/redev/overlay.js`);
  });

  const wsServer = new RedevWebSocketServer(wsPort);
  wsServer.start();

  const fileService = new FileService(projectRoot);
  const agentSpawner = new AgentSpawner({ projectRoot });
  const changeHandler = new ChangeHandler({ wsServer, fileService, agentSpawner });
  changeHandler.register();

  // MCP-facing endpoints — consumed by the `redev-mcp` stdio server
  app.get('/mcp/pending', (req, res) => {
    const el = changeHandler.pendingElement;
    const req_ = changeHandler.activeRequest;
    if (!req_ && !el) return res.json({ pending: null });
    res.json({
      pending: {
        request_id: req_?.id ?? null,
        element: el ?? req_?.element ?? null,
        prompt: req_?.prompt ?? null,
        instruction: req_?.instruction ?? null,
        project_root: projectRoot,
      },
    });
  });

  app.post('/mcp/apply', (req, res) => {
    const { summary = 'edit applied', files_edited = [] } = req.body || {};
    changeHandler.completeFromMcp({ summary, files_edited })
      .then((result) => res.json(result))
      .catch((err) => res.status(500).json({ error: err.message }));
  });

  app.post('/mcp/error', (req, res) => {
    const { error = 'unspecified error' } = req.body || {};
    changeHandler.failFromMcp(error)
      .then((result) => res.json(result))
      .catch((err) => res.status(500).json({ error: err.message }));
  });

  log(`[Redev] Project root: ${projectRoot}`);
  log(`[Redev] Drop-box:     ${projectRoot}/.redev/{pending,completed}.json`);

  if (httpPort !== preferredHttp) {
    log('');
    log(`[Redev] ⚠  HTTP moved from ${preferredHttp} → ${httpPort}. If you set backendUrl in redev-vite-plugin, update it:`);
    log(`         redev({ backendUrl: 'http://localhost:${httpPort}' })`);
  }

  return {
    httpServer,
    wsServer,
    httpPort,
    wsPort,
    stop() {
      wsServer.stop();
      httpServer.close();
    },
  };
}
