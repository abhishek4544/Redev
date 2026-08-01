#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { App } from './ui/App.js';
import { startRedevServer } from './server/index.js';

const args = process.argv.slice(2);
const demo = args.includes('--demo');
const noServer = args.includes('--no-server');

if (!demo && !noServer) {
  await startRedevServer({ log: () => {} });
  // brief delay so WS is listening before Ink connects
  await new Promise((r) => setTimeout(r, 200));
}

render(<App demo={demo} />);
