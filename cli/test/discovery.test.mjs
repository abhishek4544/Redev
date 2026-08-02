import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { discoverLocalApps } from '../dist/server/discovery.js';
import { findSessionCandidate, loadProjectSession, saveProjectSession, sessionPath } from '../dist/server/session.js';

const CHILD_SERVER = `
  const http = require('node:http');
  const kind = process.env.FIXTURE_KIND;
  const html = kind === 'next'
    ? '<!doctype html><html><head><script src="/_next/static/chunks/main.js"></script></head><body>Next fixture</body></html>'
    : '<!doctype html><html><head><script type="module" src="/@vite/client"></script></head><body>Vite fixture</body></html>';
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(html);
  });
  server.listen(0, '127.0.0.1', () => console.log(server.address().port));
`;

async function makeProject(name, dependencies) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), `redev-${name}-`));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name, dependencies, scripts: { dev: 'node server.js' } }));
  return root;
}

async function startFixture(projectRoot, kind) {
  const child = spawn(process.execPath, ['-e', CHILD_SERVER], {
    cwd: projectRoot,
    env: { ...process.env, FIXTURE_KIND: kind },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk.toString(); });
  await Promise.race([
    once(child.stdout, 'data'),
    once(child, 'error').then(([error]) => Promise.reject(error)),
  ]);
  const port = Number(output.trim());
  if (!Number.isInteger(port)) throw new Error(`Fixture did not report a port: ${output}`);

  return {
    port,
    listener: { pid: String(child.pid), command: 'node -e fixture-server', cwd: projectRoot, ports: [port] },
    async stop() {
      child.kill();
      await once(child, 'exit');
    },
  };
}

async function removeProject(root) {
  await fs.rm(root, { recursive: true, force: true });
}

test('selects the Next-like server belonging to the current project', { concurrency: false }, async () => {
  const root = await makeProject('next-current', { next: '16.0.0' });
  const fixture = await startFixture(root, 'next');
  try {
    const result = await discoverLocalApps({ projectRoot: root, listeners: [fixture.listener] });
    assert.equal(result.recommendation?.port, fixture.port, JSON.stringify(result.candidates));
    assert.equal(result.recommendation?.framework, 'Next.js');
    assert.equal(result.recommendation?.confidence, 100);
  } finally {
    await fixture.stop();
    await removeProject(root);
  }
});

test('does not silently choose when two apps belong to the same project', { concurrency: false }, async () => {
  const root = await makeProject('mixed-current', { next: '16.0.0', vite: '7.0.0' });
  const nextFixture = await startFixture(root, 'next');
  const viteFixture = await startFixture(root, 'vite');
  try {
    const result = await discoverLocalApps({ projectRoot: root, listeners: [nextFixture.listener, viteFixture.listener] });
    const fixturePorts = new Set([nextFixture.port, viteFixture.port]);
    assert.equal(result.recommendation, null);
    assert.equal(result.candidates.filter((candidate) => fixturePorts.has(candidate.port)).length, 2);
  } finally {
    await nextFixture.stop();
    await viteFixture.stop();
    await removeProject(root);
  }
});

test('prefers the current project over another project on the same machine', { concurrency: false }, async () => {
  const currentRoot = await makeProject('current-next', { next: '16.0.0' });
  const otherRoot = await makeProject('other-next', { next: '16.0.0' });
  const currentFixture = await startFixture(currentRoot, 'next');
  const otherFixture = await startFixture(otherRoot, 'next');
  try {
    const result = await discoverLocalApps({ projectRoot: currentRoot, listeners: [currentFixture.listener, otherFixture.listener] });
    assert.equal(result.recommendation?.port, currentFixture.port, JSON.stringify(result.candidates));
    const otherCandidate = result.candidates.find((candidate) => candidate.port === otherFixture.port);
    assert.ok(otherCandidate);
    assert.ok(otherCandidate.confidence < result.recommendation.confidence);
  } finally {
    await currentFixture.stop();
    await otherFixture.stop();
    await removeProject(currentRoot);
    await removeProject(otherRoot);
  }
});

test('restores a unique saved app identity without persisting its port', { concurrency: false }, async () => {
  const root = await makeProject('saved-selection', { next: '16.0.0', vite: '7.0.0' });
  const nextFixture = await startFixture(root, 'next');
  const viteFixture = await startFixture(root, 'vite');
  try {
    const result = await discoverLocalApps({ projectRoot: root, listeners: [nextFixture.listener, viteFixture.listener] });
    const nextCandidate = result.candidates.find((candidate) => candidate.port === nextFixture.port);
    assert.ok(nextCandidate);
    saveProjectSession(result.profile.root, nextCandidate);
    const session = loadProjectSession(result.profile.root);
    assert.ok(session);
    assert.equal('port' in session.app, false);
    assert.equal(findSessionCandidate(session, result.candidates, result.profile.root)?.port, nextFixture.port);
    assert.equal(await fs.access(sessionPath(result.profile.root)).then(() => true), true);
  } finally {
    await nextFixture.stop();
    await viteFixture.stop();
    await removeProject(root);
  }
});

test('does not restore a saved session when two current apps share its identity', { concurrency: false }, async () => {
  const root = await makeProject('duplicate-selection', { next: '16.0.0' });
  const firstFixture = await startFixture(root, 'next');
  const secondFixture = await startFixture(root, 'next');
  try {
    const result = await discoverLocalApps({ projectRoot: root, listeners: [firstFixture.listener, secondFixture.listener] });
    const firstCandidate = result.candidates.find((candidate) => candidate.port === firstFixture.port);
    assert.ok(firstCandidate);
    saveProjectSession(result.profile.root, firstCandidate);
    assert.equal(findSessionCandidate(loadProjectSession(result.profile.root), result.candidates, result.profile.root), null);
  } finally {
    await firstFixture.stop();
    await secondFixture.stop();
    await removeProject(root);
  }
});

test('does not restore a session whose process belongs to another project', { concurrency: false }, async () => {
  const currentRoot = await makeProject('session-current', { next: '16.0.0' });
  const otherRoot = await makeProject('session-other', { next: '16.0.0' });
  const otherFixture = await startFixture(otherRoot, 'next');
  try {
    const otherResult = await discoverLocalApps({ projectRoot: otherRoot, listeners: [otherFixture.listener] });
    const otherCandidate = otherResult.candidates.find((candidate) => candidate.port === otherFixture.port);
    assert.ok(otherCandidate);
    saveProjectSession(currentRoot, otherCandidate);
    const session = loadProjectSession(currentRoot);
    assert.equal(findSessionCandidate(session, [otherCandidate], currentRoot), null);
  } finally {
    await otherFixture.stop();
    await removeProject(currentRoot);
    await removeProject(otherRoot);
  }
});
