import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const COMMON_DEV_PORTS = [3000, 3001, 3003, 3004, 4200, 4321, 5173, 5174, 8080];
const PROBE_TIMEOUT_MS = 700;

function commandOutput(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function insideDirectory(child, parent) {
  if (!child || !parent) return false;
  const canonical = (value) => {
    try {
      return fs.realpathSync(value);
    } catch {
      return path.resolve(value);
    }
  };
  const relative = path.relative(canonical(parent), canonical(child));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function nearestPackageRoot(startDirectory) {
  let directory = path.resolve(startDirectory);
  while (true) {
    if (fs.existsSync(path.join(directory, 'package.json'))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) return path.resolve(startDirectory);
    directory = parent;
  }
}

function readProjectProfile(startDirectory) {
  const root = nearestPackageRoot(startDirectory);
  const packagePath = path.join(root, 'package.json');
  let pkg = {};
  try {
    pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch {}

  const dependencies = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const scripts = Object.values(pkg.scripts || {}).join(' ');
  const frameworks = [];
  const add = (name, dependency, command) => {
    if (dependencies[dependency] || new RegExp(`\\b${command}\\b`, 'i').test(scripts)) frameworks.push(name);
  };

  add('Next.js', 'next', 'next');
  add('Vite', 'vite', 'vite');
  add('Astro', 'astro', 'astro');
  add('Remix', '@remix-run/react', 'remix');
  add('SvelteKit', '@sveltejs/kit', 'svelte-kit');

  return { root, name: pkg.name || path.basename(root), frameworks, scripts };
}

function parseListeners(output) {
  const byPid = new Map();
  let pid = null;
  let command = '';

  for (const line of output.split('\n')) {
    if (!line) continue;
    const key = line[0];
    const value = line.slice(1);
    if (key === 'p') {
      pid = value;
      if (!byPid.has(pid)) byPid.set(pid, { pid, command: '', ports: new Set() });
    } else if (key === 'c' && pid) {
      command = value;
      byPid.get(pid).command = command;
    } else if (key === 'n' && pid) {
      const portMatch = value.match(/:(\d+)(?:\s|$)/);
      if (portMatch) byPid.get(pid).ports.add(Number(portMatch[1]));
    }
  }

  return [...byPid.values()].map((entry) => ({ ...entry, command: entry.command || command, ports: [...entry.ports] }));
}

function processDetails(pid) {
  const command = commandOutput('ps', ['-p', String(pid), '-o', 'command=']).trim();
  const cwdOutput = commandOutput('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
  const cwdLine = cwdOutput.split('\n').find((line) => line.startsWith('n'));
  return { command, cwd: cwdLine ? cwdLine.slice(1) : null };
}

function discoverListeners() {
  const output = commandOutput('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpcn']);
  if (!output) return [];
  return parseListeners(output)
    .filter((listener) => isLikelyDevCommand(listener.command) || listener.ports.some((port) => COMMON_DEV_PORTS.includes(port)))
    .map((listener) => ({ ...listener, ...processDetails(listener.pid) }));
}

function classifyFramework({ html, headers, command, profile }) {
  const source = `${html}\n${command}\n${headers.get('x-powered-by') || ''}`.toLowerCase();
  const has = (value) => source.includes(value);
  if (has('/_next/') || has('__next_data__') || has('__next_f') || has('next dev')) return 'Next.js';
  if (has('/@vite/client') || has('vite')) return 'Vite';
  if (has('/_astro/') || has('astro dev')) return 'Astro';
  if (has('remix')) return 'Remix';
  if (has('_app/immutable') || has('svelte-kit')) return 'SvelteKit';
  return profile.frameworks.length === 1 ? profile.frameworks[0] : 'generic';
}

function documentFingerprint(html, framework) {
  // Exclude build- and HMR-specific tags so a routine dev-server restart does
  // not make a remembered app unrecognizable. This is identity evidence, not a
  // security boundary, and is always combined with project/process evidence.
  const stableDocument = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+/g, ' ')
    .slice(0, 16_000);
  return createHash('sha256').update(`${framework}\0${stableDocument}`).digest('hex').slice(0, 24);
}

function isLikelyDevCommand(command) {
  return /\b(next|vite|astro|remix|svelte|webpack|parcel|rspack|nuxt|node|bun|deno)\b/i.test(command || '');
}

async function probePort(port, listener, profile) {
  const baseUrl = `http://localhost:${port}`;
  try {
    const response = await fetch(`${baseUrl}/`, { redirect: 'manual', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');
    const html = isHtml ? (await response.text()).slice(0, 64_000) : '';
    const framework = classifyFramework({ html, headers: response.headers, command: listener?.command || '', profile });
    return {
      baseUrl,
      status: response.status,
      isHtml,
      isRedevProxy: html.includes('data-redev-overlay'),
      framework,
      fingerprint: documentFingerprint(html, framework),
      html,
    };
  } catch {
    return null;
  }
}

function scoreCandidate({ probe, listener, profile }) {
  let confidence = 0;
  const reasons = [];
  const command = listener?.command || '';

  if (!probe.isHtml) return { confidence: -25, reasons: ['does not serve an HTML document'] };
  confidence += 15;
  reasons.push('serves HTML');
  if (probe.status >= 200 && probe.status < 400) {
    confidence += 10;
    reasons.push(`responds with HTTP ${probe.status}`);
  } else {
    confidence -= 20;
    reasons.push(`responds with HTTP ${probe.status}`);
  }

  if (listener?.cwd && insideDirectory(listener.cwd, profile.root)) {
    confidence += 45;
    reasons.push('server process belongs to this project');
  }
  if (isLikelyDevCommand(command)) {
    confidence += 15;
    reasons.push('development-server process');
  }
  if (probe.framework !== 'generic' && profile.frameworks.includes(probe.framework)) {
    confidence += 25;
    reasons.push(`${probe.framework} response matches this project`);
  } else if (probe.framework !== 'generic') {
    confidence += 5;
    reasons.push(`detected ${probe.framework}`);
  }
  if (listener?.cwd && !insideDirectory(listener.cwd, profile.root)) {
    confidence -= 40;
    reasons.push('server process belongs to another project');
  }

  return { confidence: Math.max(0, Math.min(100, confidence)), reasons };
}

/**
 * Discover browser apps on loopback and rank them for the project that invoked
 * Redev. This is intentionally conservative: callers should only auto-attach
 * to `recommendation`, and present `candidates` when it is null.
 */
export async function discoverLocalApps({ projectRoot = process.cwd() } = {}) {
  const profile = readProjectProfile(projectRoot);
  const listeners = discoverListeners();
  const listenersByPort = new Map();
  for (const listener of listeners) {
    for (const port of listener.ports) listenersByPort.set(port, listener);
  }

  // Prefer listeners that demonstrably belong to the current project, then
  // common development ports, then other likely development listeners. This
  // keeps unrelated system listeners from exhausting the probe budget.
  const projectPorts = listeners
    .filter((listener) => listener.cwd && insideDirectory(listener.cwd, profile.root))
    .flatMap((listener) => listener.ports);
  const devProcessPorts = listeners
    .filter((listener) => isLikelyDevCommand(listener.command))
    .flatMap((listener) => listener.ports);
  const ports = [...new Set([...projectPorts, ...COMMON_DEV_PORTS, ...devProcessPorts])]
    .filter((port) => port > 0 && port < 65_536)
    .slice(0, 40);
  const probedCandidates = await Promise.all(ports.map(async (port) => {
    const listener = listenersByPort.get(port);
    if (listener && !isLikelyDevCommand(listener.command)) return null;
    const probe = await probePort(port, listener, profile);
    // A running Redev proxy mirrors the target app's HTML and therefore looks
    // like a valid framework server. It is a transport for another candidate,
    // not an app that should be selected again.
    if (!probe?.isHtml || probe.isRedevProxy || probe.status < 200 || probe.status >= 400) return null;
    const { confidence, reasons } = scoreCandidate({ probe, listener, profile });
    return {
      id: `${listener?.pid || 'unknown'}:${port}`,
      baseUrl: probe.baseUrl,
      port,
      framework: probe.framework,
      fingerprint: probe.fingerprint,
      confidence,
      reasons,
      process: listener ? { pid: listener.pid, command: listener.command, cwd: listener.cwd } : null,
    };
  }));
  const candidates = [];
  for (const candidate of probedCandidates) {
    if (candidate) candidates.push(candidate);
  }

  candidates.sort((a, b) => b.confidence - a.confidence || a.port - b.port);
  const [first, second] = candidates;
  const unambiguous = first && first.confidence >= 80 && (!second || first.confidence - second.confidence >= 20);

  return {
    profile,
    candidates,
    recommendation: unambiguous ? first : null,
  };
}
