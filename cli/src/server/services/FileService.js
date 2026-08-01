import fs from 'fs/promises';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const REDEV_DIR = '.redev';
const PENDING_FILE = 'pending.json';
const COMPLETED_FILE = 'completed.json';
const LOG_FILE = 'log.md';

export class FileService {
  constructor(projectRoot) {
    this.projectRoot = projectRoot ? path.resolve(projectRoot) : null;
  }

  resolveFile(relativePath) {
    if (!this.projectRoot) return null;
    const resolved = path.resolve(this.projectRoot, relativePath);
    if (!resolved.startsWith(this.projectRoot + path.sep) && resolved !== this.projectRoot) {
      throw new Error(`Path traversal blocked: ${relativePath}`);
    }
    return resolved;
  }

  async readFile(relativePath) {
    const absolute = this.resolveFile(relativePath);
    if (!absolute) return null;
    if (!existsSync(absolute)) return null;
    return fs.readFile(absolute, 'utf-8');
  }

  async fileExists(relativePath) {
    const absolute = this.resolveFile(relativePath);
    return absolute !== null && existsSync(absolute);
  }

  redevDir() {
    if (!this.projectRoot) return null;
    const dir = path.join(this.projectRoot, REDEV_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return dir;
  }

  pendingPath() {
    const dir = this.redevDir();
    return dir ? path.join(dir, PENDING_FILE) : null;
  }

  completedPath() {
    const dir = this.redevDir();
    return dir ? path.join(dir, COMPLETED_FILE) : null;
  }

  logPath() {
    const dir = this.redevDir();
    return dir ? path.join(dir, LOG_FILE) : null;
  }

  async writePending(request) {
    const p = this.pendingPath();
    if (!p) throw new Error('No project root configured');
    await fs.writeFile(p, JSON.stringify(request, null, 2) + '\n', 'utf-8');
    return p;
  }

  async clearPending() {
    const p = this.pendingPath();
    if (p && existsSync(p)) await fs.unlink(p);
  }

  async readCompleted() {
    const p = this.completedPath();
    if (!p || !existsSync(p)) return null;
    try {
      const raw = await fs.readFile(p, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async clearCompleted() {
    const p = this.completedPath();
    if (p && existsSync(p)) await fs.unlink(p);
  }

  async appendLog(line) {
    const p = this.logPath();
    if (!p) return;
    const timestamp = new Date().toISOString();
    await fs.appendFile(p, `- \`${timestamp}\` ${line}\n`, 'utf-8');
  }
}
