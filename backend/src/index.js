import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { RedevWebSocketServer } from './websocket/server.js';
import { OVERLAY_SCRIPT } from './overlay-server/overlay-script.js';
import { FileService } from './services/FileService.js';
import { ChangeHandler } from './services/ChangeHandler.js';
import { AgentSpawner } from './services/AgentSpawner.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const HTTP_PORT = process.env.PORT || 5050;
const WS_PORT = process.env.WS_PORT || 3001;
const PROJECT_ROOT = process.env.REDEV_PROJECT_ROOT || null;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    projectRoot: PROJECT_ROOT,
    mode: 'drop-box',
  });
});

app.get('/redev/overlay.js', (req, res) => {
  res.type('application/javascript');
  res.send(OVERLAY_SCRIPT);
});

app.get('/redev/inject.html', (req, res) => {
  res.type('text/html');
  res.send(`<script src="http://localhost:${HTTP_PORT}/redev/overlay.js"></script>`);
});

app.use('/test', express.static(path.join(__dirname, '..', 'public')));
app.use('/site', express.static(path.join(__dirname, '..', '..', 'website')));

app.get('/', (req, res) => {
  res.redirect('/redev');
});

app.get('/redev', (req, res) => {
  res.redirect('/test/test-app.html');
});

app.listen(HTTP_PORT, () => {
  console.log(`Redev HTTP server: http://localhost:${HTTP_PORT}`);
  console.log(`   Overlay script:  http://localhost:${HTTP_PORT}/redev/overlay.js`);
});

const wsServer = new RedevWebSocketServer(WS_PORT);
wsServer.start();

const fileService = new FileService(PROJECT_ROOT);
const agentSpawner = new AgentSpawner({ projectRoot: PROJECT_ROOT });
const changeHandler = new ChangeHandler({ wsServer, fileService, agentSpawner });
changeHandler.register();

console.log('');
console.log('Configuration:');
console.log(`   Mode:         drop-box (agent-agnostic; uses your Claude Code — no API key needed)`);
console.log(`   Project root: ${PROJECT_ROOT || 'NOT SET (set REDEV_PROJECT_ROOT in backend/.env)'}`);
if (PROJECT_ROOT) {
  console.log(`   Drop-box:     ${PROJECT_ROOT}/.redev/{pending,completed}.json`);
}
console.log('');

process.on('SIGINT', () => {
  console.log('\n[Redev] Shutting down...');
  wsServer.stop();
  process.exit(0);
});
