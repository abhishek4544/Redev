import WebSocket from 'ws';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ws = new WebSocket('ws://localhost:3001?client=cli');
const log = (...a) => console.log('[TEST]', ...a);

ws.on('open', () => {
  log('connected as CLI');
  setTimeout(() => {
    log('sending change-request');
    ws.send(JSON.stringify({ type: 'change-request', prompt: 'make the heading red' }));
  }, 300);
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  log('recv:', JSON.stringify(msg).slice(0, 400));

  if (msg.type === 'awaiting-agent') {
    const pending = JSON.parse(readFileSync(msg.pendingPath, 'utf-8'));
    log('pending.json ID:', pending.id, 'element file:', pending.element?.file);
    const completedPath = path.join(path.dirname(msg.pendingPath), 'completed.json');
    log('writing completed.json to', completedPath);
    writeFileSync(completedPath, JSON.stringify({
      id: pending.id,
      completed_at: new Date().toISOString(),
      files_edited: [pending.element.file],
      summary: 'simulated: changed heading color to red',
    }, null, 2));
  }

  if (msg.type === 'agent-completed') {
    log('SUCCESS — end-to-end drop-box flow works');
    setTimeout(() => { ws.close(); process.exit(0); }, 500);
  }
  if (msg.type === 'change-generated' && msg.error) {
    log('BACKEND ERROR:', msg.error);
    ws.close(); process.exit(1);
  }
});

ws.on('error', (e) => { log('WS error', e.message); process.exit(2); });
setTimeout(() => { log('timeout'); process.exit(3); }, 15000);
