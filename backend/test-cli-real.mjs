import WebSocket from 'ws';
const ws = new WebSocket('ws://localhost:3001?client=cli');
const log = (...a) => console.log('[TEST]', ...a);
const t0 = Date.now();

ws.on('open', () => {
  log('connected as CLI');
  setTimeout(() => {
    log('sending change-request → real Claude Code will spawn');
    ws.send(JSON.stringify({
      type: 'change-request',
      prompt: 'Change the H1 heading text to include a rocket emoji at the end (🚀).',
    }));
  }, 300);
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw.toString());
  const t = ((Date.now() - t0) / 1000).toFixed(1) + 's';
  log(t, 'recv:', JSON.stringify(msg).slice(0, 300));

  if (msg.type === 'agent-completed') {
    log('SUCCESS in', t);
    setTimeout(() => process.exit(0), 300);
  }
  if (msg.type === 'change-generated' && msg.error) {
    log('FAIL:', msg.error);
    process.exit(1);
  }
});
ws.on('error', (e) => { log('WS err', e.message); process.exit(2); });
setTimeout(() => { log('timeout at 180s'); process.exit(3); }, 180000);
