#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();

const c = (n) => (s) => `\x1b[${n}m${s}\x1b[0m`;
const accent = c('33');
const ok = c('32');
const warn = c('31');
const dim = c('90');
const bold = c('1');

function fatal(msg) {
  console.error(`\n  ${warn('✗')} ${msg}\n`);
  process.exit(1);
}

function banner() {
  console.log('');
  console.log(`  ${accent('▮')} ${bold('create-redev')} ${dim('· click-to-edit for your dev server')}`);
  console.log('');
}

function readPkg() {
  const p = path.join(cwd, 'package.json');
  if (!fs.existsSync(p)) fatal('No package.json in current directory. Run this from your project root.');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    fatal(`package.json is invalid JSON: ${e.message}`);
  }
}

function detectFramework(pkg) {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  if (deps.next) return 'next';
  if (deps.vite) return 'vite';
  return 'other';
}

function detectPM() {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(cwd, 'bun.lockb')) || fs.existsSync(path.join(cwd, 'bun.lock'))) return 'bun';
  return 'npm';
}

function install(pm, pkgs) {
  const argMap = {
    npm: ['install', '-D', ...pkgs],
    pnpm: ['add', '-D', ...pkgs],
    yarn: ['add', '-D', ...pkgs],
    bun: ['add', '-d', ...pkgs],
  };
  const args = argMap[pm];
  console.log(`  ${dim('$')} ${pm} ${args.join(' ')}`);
  console.log('');
  const r = spawnSync(pm, args, { stdio: 'inherit', cwd });
  if (r.status !== 0) fatal(`${pm} install failed. Fix the error above and re-run.`);
}

function findFirstExisting(candidates) {
  for (const rel of candidates) {
    const abs = path.join(cwd, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

function insertAfterImports(src, newLine) {
  const importRe = /(^(?:import[^\n]*\n)+)/m;
  if (importRe.test(src)) return src.replace(importRe, (m) => m + newLine + '\n');
  return newLine + '\n' + src;
}

function editNextLayout() {
  const file = findFirstExisting([
    'app/layout.tsx', 'app/layout.jsx',
    'src/app/layout.tsx', 'src/app/layout.jsx',
  ]);
  if (!file) return { ok: false, reason: 'no app/layout.tsx (App Router) found' };

  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('RedevScript')) return { ok: true, alreadyDone: true, file };

  src = insertAfterImports(src, `import { RedevScript } from 'redev-nextjs'`);

  const bodyClose = /(\r?\n)([ \t]*)(<\/body>)|(<\/body>)/;
  const m = src.match(bodyClose);
  if (!m) return { ok: false, reason: `no </body> tag in ${path.relative(cwd, file)}` };
  src = src.replace(bodyClose, (_full, nl, indent, tag, singleTag) => {
    if (nl) return `${nl}${indent}<RedevScript />${nl}${indent}${tag}`;
    return ` <RedevScript />${singleTag}`;
  });

  fs.writeFileSync(file, src);
  return { ok: true, file: path.relative(cwd, file) };
}

function editViteConfig() {
  const file = findFirstExisting([
    'vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts',
  ]);
  if (!file) return { ok: false, reason: 'no vite.config file found' };

  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('redev-vite-plugin') || /\bredev\s*\(\s*\)/.test(src)) {
    return { ok: true, alreadyDone: true, file };
  }

  src = insertAfterImports(src, `import redev from 'redev-vite-plugin'`);

  const pluginsRe = /plugins:\s*\[([\s\S]*?)\]/;
  const m = src.match(pluginsRe);
  if (!m) return { ok: false, reason: `no "plugins: [...]" array in ${path.relative(cwd, file)}` };
  const inner = m[1];
  const trimmed = inner.trim();
  const replacement = trimmed
    ? `plugins: [${inner.replace(/,?\s*$/, '')}, redev()]`
    : `plugins: [redev()]`;
  src = src.replace(pluginsRe, replacement);

  fs.writeFileSync(file, src);
  return { ok: true, file: path.relative(cwd, file) };
}

function printManualSnippet(fw) {
  if (fw === 'next') {
    console.log(`  ${dim('paste into app/layout.tsx:')}`);
    console.log('');
    console.log(`    ${accent("import")} { RedevScript } ${accent("from")} 'redev-nextjs'`);
    console.log(`    ${dim('// ...inside <body>')}`);
    console.log(`    ${accent('<RedevScript />')}`);
    console.log('');
  } else if (fw === 'vite') {
    console.log(`  ${dim('paste into vite.config:')}`);
    console.log('');
    console.log(`    ${accent("import")} redev ${accent("from")} 'redev-vite-plugin'`);
    console.log(`    plugins: [react(), ${accent('redev()')}]`);
    console.log('');
  } else {
    console.log(`  ${dim('paste into your root template (dev-only):')}`);
    console.log('');
    console.log(`    ${accent('<script async src="http://localhost:5050/redev/overlay.js"></script>')}`);
    console.log('');
  }
}

function usage() {
  console.log(`
  ${bold('create-redev')} ${dim('— one-command redev setup')}

  ${dim('Usage:')}
    npx create-redev@latest                ${dim('# auto-detect framework')}
    npx create-redev@latest --next         ${dim('# force Next.js path')}
    npx create-redev@latest --vite         ${dim('# force Vite path')}
    npx create-redev@latest --manual       ${dim('# just install redev-cli, print script tag')}
    npx create-redev@latest --no-edit      ${dim('# install packages but do not modify source files')}
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) return usage();

  banner();

  const pkg = readPkg();
  const forcedFw = args.includes('--next') ? 'next'
                 : args.includes('--vite') ? 'vite'
                 : args.includes('--manual') ? 'other'
                 : null;
  const fw = forcedFw ?? detectFramework(pkg);
  const pm = detectPM();
  const noEdit = args.includes('--no-edit');

  const fwLabel = { next: 'Next.js', vite: 'Vite', other: 'manual (raw script tag)' }[fw];
  console.log(`  ${dim('framework:')} ${accent(fwLabel)}   ${dim('package manager:')} ${accent(pm)}`);
  console.log('');

  const packages = ['redev-cli'];
  if (fw === 'next') packages.push('redev-nextjs');
  if (fw === 'vite') packages.push('redev-vite-plugin');

  install(pm, packages);

  console.log('');
  if (noEdit || fw === 'other') {
    printManualSnippet(fw);
  } else if (fw === 'next') {
    const r = editNextLayout();
    if (r.alreadyDone) console.log(`  ${dim(r.file + ' already has <RedevScript />, skipping edit')}`);
    else if (r.ok) console.log(`  ${ok('✓')} edited ${bold(r.file)}`);
    else {
      console.log(`  ${warn('⚠')} ${r.reason}`);
      console.log('');
      printManualSnippet('next');
    }
  } else if (fw === 'vite') {
    const r = editViteConfig();
    if (r.alreadyDone) console.log(`  ${dim(r.file + ' already wired up, skipping edit')}`);
    else if (r.ok) console.log(`  ${ok('✓')} edited ${bold(r.file)}`);
    else {
      console.log(`  ${warn('⚠')} ${r.reason}`);
      console.log('');
      printManualSnippet('vite');
    }
  }

  console.log('');
  console.log(`  ${ok('done.')} start it:`);
  console.log('');
  console.log(`    ${accent('$')} npm run dev        ${dim('# tab 1')}`);
  console.log(`    ${accent('$')} npx redev-cli      ${dim('# tab 2')}`);
  console.log('');
  console.log(`  then open your app and press ${accent('Cmd+Shift+E')}.`);
  console.log('');
}

main().catch((e) => fatal(e.stack || e.message));
