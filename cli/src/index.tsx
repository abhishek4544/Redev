#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { createInterface } from 'node:readline/promises';
import { App } from './ui/App.js';
import { startRedevServer } from './server/index.js';
import { discoverLocalApps } from './server/discovery.js';
import { findSessionCandidate, loadProjectSession, saveProjectSession } from './server/session.js';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Redev — click any element in your dev app, describe the change, ship it.

Usage:
  npx redev-cli [options]
  npx redev-cli doctor

Options:
  --app <url>         Dev server URL to attach to (e.g. http://localhost:3000)
  --port <n>          HTTP port for the Redev proxy (default: 5050)
  --ws-port <n>       WebSocket port (default: 3001)
  --demo              Run the UI in demo mode without a dev server
  --no-server         Skip starting the proxy (advanced)
  doctor              List detected local apps and why each was or wasn't picked
  -h, --help          Show this help

Docs: https://github.com/abhishek4544/Redev
`);
  process.exit(0);
}

if (args.includes('--version') || args.includes('-v')) {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { dirname, join } = await import('node:path');
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
  console.log(pkg.version);
  process.exit(0);
}

const demo = args.includes('--demo');
const noServer = args.includes('--no-server');
const doctor = args[0] === 'doctor' || args.includes('--doctor');

function optionValue(name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value (for example: ${name} http://localhost:3003)`);
  }
  return value;
}

const proxyTarget = optionValue('--app') ?? optionValue('--proxy');
const httpPort = optionValue('--port');
const wsPort = optionValue('--ws-port');
let activeWsPort = 3001;

async function chooseApp() {
  const discovery = await discoverLocalApps({ projectRoot: process.cwd() });
  const savedCandidate = findSessionCandidate(loadProjectSession(discovery.profile.root), discovery.candidates, discovery.profile.root);
  if (savedCandidate) {
    console.log(`\n✓ Reusing this project's previous app: ${savedCandidate.baseUrl}`);
    return savedCandidate;
  }
  if (discovery.recommendation) {
    saveProjectSession(discovery.profile.root, discovery.recommendation);
    return discovery.recommendation;
  }
  if (discovery.candidates.length === 0) {
    throw new Error('No local browser app matched this project. Start your dev server or pass --app http://localhost:<port>.');
  }
  if (!process.stdin.isTTY) {
    const list = discovery.candidates
      .map((c) => `    ${c.framework} — ${c.baseUrl}`)
      .join('\n');
    throw new Error(
      `Several local apps look plausible:\n${list}\n\nRe-run with --app <url>, e.g. --app ${discovery.candidates[0]!.baseUrl}`,
    );
  }

  console.log('\n? Which app should Redev edit?\n');
  discovery.candidates.forEach((candidate, index) => {
    const detail = candidate.reasons.join(', ');
    console.log(`  ${index + 1}. ${candidate.framework} — ${candidate.baseUrl} (${candidate.confidence}%: ${detail})`);
  });
  const readline = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await readline.question(`\nChoose 1-${discovery.candidates.length}: `);
  readline.close();
  const selected = discovery.candidates[Number(answer) - 1];
  if (!selected) throw new Error('No app selected. Re-run Redev and choose a listed app.');
  saveProjectSession(discovery.profile.root, selected);
  return selected;
}

try {
if (doctor) {
  const discovery = await discoverLocalApps({ projectRoot: process.cwd() });
  console.log(`\nRedev doctor\n`);
  console.log(`Project: ${discovery.profile.name} (${discovery.profile.root})`);
  console.log(`Framework hints: ${discovery.profile.frameworks.join(', ') || 'none'}`);
  const savedCandidate = findSessionCandidate(loadProjectSession(discovery.profile.root), discovery.candidates, discovery.profile.root);
  console.log(`Saved session: ${savedCandidate ? `${savedCandidate.baseUrl} (matched)` : 'none or no unique match'}`);
  if (discovery.candidates.length === 0) {
    console.log(`Browser apps: none detected`);
    process.exitCode = 1;
  } else {
    console.log(`\nBrowser apps:`);
    discovery.candidates.forEach((candidate) => {
      const selected = discovery.recommendation?.id === candidate.id ? ' ✓ recommended' : '';
      console.log(`  ${candidate.framework} — ${candidate.baseUrl} — ${candidate.confidence}%${selected}`);
      console.log(`    ${candidate.reasons.join('; ')}`);
    });
  }
  console.log('');
} else {
  if (!demo && !noServer) {
    const resolvedProxyTarget = proxyTarget ?? (await chooseApp()).baseUrl;
    const server = await startRedevServer({
      proxyTarget: resolvedProxyTarget,
      httpPort: httpPort ? Number(httpPort) : undefined,
      wsPort: wsPort ? Number(wsPort) : undefined,
      log: () => {},
    });
    activeWsPort = server.wsPort;
    console.log(`\n✓ Redev attached to ${server.proxyTarget}`);
    console.log(`  Open http://localhost:${server.httpPort} to edit this app.\n`);
    // brief delay so WS is listening before Ink connects
    await new Promise((r) => setTimeout(r, 200));
  }

  render(<App demo={demo} wsPort={activeWsPort} />);
}
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}
