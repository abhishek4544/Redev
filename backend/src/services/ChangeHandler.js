import { existsSync, watch } from 'fs';
import path from 'path';
import { MESSAGE_TYPES } from '../websocket/protocol.js';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export class ChangeHandler {
  constructor({ wsServer, fileService, agentSpawner = null }) {
    this.wsServer = wsServer;
    this.fileService = fileService;
    this.agentSpawner = agentSpawner;
    this.pendingElement = null;
    this.activeRequest = null;
    this.completedWatcher = null;
    this.requestTimeout = null;
  }

  register() {
    this.wsServer.on('cli-message', (message) => this.handleCliMessage(message));
    this.wsServer.on('browser-message', (message) => this.handleBrowserMessage(message));
    this.startCompletedWatcher();
  }

  handleBrowserMessage(message) {
    if (message.type === MESSAGE_TYPES.ELEMENT_SELECTED && message.element) {
      this.pendingElement = message.element;
    } else if (message.type === 'change-request') {
      this.handleChangeRequest(message, 'browser');
    } else if (message.type === 'cancel-request') {
      this.cancelRequest('cancelled by user');
    }
  }

  async handleCliMessage(message) {
    if (message.type === 'change-request') {
      await this.handleChangeRequest(message, 'cli');
    } else if (message.type === 'change-applied') {
      await this.handleManualApply(message);
    } else if (message.type === 'cancel-request') {
      await this.cancelRequest('cancelled by user');
    }
  }

  async handleChangeRequest(message, source = 'cli') {
    const element = this.pendingElement;
    if (!element) {
      this.sendCli({
        type: 'change-generated',
        error: 'No element selected. Click an element in the browser first.',
      });
      return;
    }

    if (!this.fileService.projectRoot) {
      this.sendCli({
        type: 'change-generated',
        error: 'REDEV_PROJECT_ROOT is not set. Add it to backend/.env and restart.',
      });
      return;
    }

    const requestId = `req_${Date.now()}`;
    const request = {
      id: requestId,
      created_at: new Date().toISOString(),
      status: 'pending',
      element,
      prompt: message.prompt,
      instruction: this.buildInstruction(element, message.prompt),
    };

    try {
      const pendingPath = await this.fileService.writePending(request);
      await this.fileService.appendLog(`request ${requestId}: "${message.prompt}" on ${element.file}:${element.line}`);
      console.log(`[Redev] Wrote pending request → ${pendingPath}`);

      this.activeRequest = request;
      this.armTimeout();

      const autoSpawned = source === 'cli' && this.agentSpawner?.isEnabled();
      const shellSafe = (s) => `"${String(s).replace(/(["\\$`])/g, '\\$1')}"`;
      const copyCommand = `cd ${shellSafe(this.fileService.projectRoot)} && claude -p ${shellSafe(this.buildAgentPrompt())} --dangerously-skip-permissions`;

      this.wsServer.broadcastAll({
        type: 'awaiting-agent',
        requestId,
        pendingPath,
        promptForAgent: this.buildAgentPrompt(),
        copyCommand,
        autoSpawned,
        source,
      });

      if (autoSpawned) {
        this.agentSpawner.spawnAgent(this.buildAgentPrompt(), {
          onExit: ({ code, error, stdout, stderr }) => {
            if (!this.activeRequest) return;
            setTimeout(() => {
              if (!this.activeRequest) return;
              const completedExists = existsSync(this.fileService.completedPath());
              if (completedExists) return;
              const detail = error
                || (stderr ? stderr.slice(0, 300) : null)
                || (stdout ? `agent said: "${stdout.slice(0, 200).trim()}"` : `exit code ${code}, no completed.json`);
              console.error(`[Redev] Auto-agent finished without writing completed.json: ${detail}`);
              this.sendCli({
                type: 'change-generated',
                error: `Auto-agent did not complete the edit. ${detail}`,
              });
              this.clearTimeout();
              this.activeRequest = null;
              this.fileService.clearPending().catch(() => {});
            }, 500);
          },
        });
      }
    } catch (err) {
      console.error('[Redev] Failed to write pending request:', err);
      this.sendCli({
        type: 'change-generated',
        error: `Failed to write pending request: ${err.message}`,
      });
    }
  }

  buildInstruction(element, prompt) {
    return [
      `A user clicked a UI element in their running app and asked for a change.`,
      ``,
      `**Target element:** <${element.tagName}> at ${element.file}:${element.line}`,
      `**Enclosing component:** ${element.component}`,
      `**Current classes:** ${element.classes.join(' ') || '(none)'}`,
      ``,
      `**User request:** "${prompt}"`,
      ``,
      `Steps to satisfy this request:`,
      `1. Read the source file: ${element.file}`,
      `2. Locate the element at line ${element.line} (should match the tag and classes above)`,
      `3. Make the minimal edit that satisfies the request. Prefer Tailwind utilities if the file already uses them. Preserve existing formatting, imports, and component structure.`,
      `4. After editing, write .redev/completed.json with this shape:`,
      `   {`,
      `     "id": "${'${requestId}'}",`,
      `     "completed_at": "ISO timestamp",`,
      `     "files_edited": ["${element.file}"],`,
      `     "summary": "one-line description of what changed"`,
      `   }`,
      `5. If you cannot satisfy the request (ambiguous, would require multi-file changes, etc.), write .redev/completed.json with an "error" field explaining why instead of files_edited.`,
    ].join('\n');
  }

  buildAgentPrompt() {
    return 'Read .redev/pending.json, follow its instructions, then write .redev/completed.json when done.';
  }

  async handleManualApply(message) {
    const changes = message.changes || [];
    if (changes.length === 0) return;
    this.sendCli({ type: 'apply-result', results: changes.map((c) => ({ file: c.file, applied: false, reason: 'manual-apply-not-supported-in-drop-box-mode' })) });
  }

  startCompletedWatcher() {
    const dir = this.fileService.redevDir();
    if (!dir) {
      console.log('[Redev] Skipping completed-watcher — no project root configured');
      return;
    }

    console.log(`[Redev] Watching for agent completion at ${path.join(dir, 'completed.json')}`);

    this.completedWatcher = watch(dir, { persistent: true }, (eventType, filename) => {
      if (filename !== 'completed.json') return;
      const completedPath = this.fileService.completedPath();
      if (!existsSync(completedPath)) return;
      this.consumeCompleted().catch((err) => {
        console.error('[Redev] Failed to consume completed.json:', err);
      });
    });
  }

  async consumeCompleted() {
    const completed = await this.fileService.readCompleted();
    if (!completed) return;

    if (!this.activeRequest) {
      console.warn('[Redev] Received completed.json with no active request — ignoring');
      await this.fileService.clearCompleted();
      return;
    }

    if (completed.id && completed.id !== this.activeRequest.id) {
      console.warn(`[Redev] completed.json id (${completed.id}) doesn't match active request (${this.activeRequest.id}) — consuming anyway`);
    }

    this.clearTimeout();

    if (completed.error) {
      console.log(`[Redev] Agent reported error: ${completed.error}`);
      await this.fileService.appendLog(`request ${this.activeRequest.id}: agent error — ${completed.error}`);
      this.sendCli({
        type: 'change-generated',
        error: `Agent could not complete the request: ${completed.error}`,
      });
    } else {
      const files = completed.files_edited || [];
      const summary = completed.summary || 'edit applied';
      console.log(`[Redev] Agent completed request. Files: ${files.join(', ')}. Summary: ${summary}`);
      await this.fileService.appendLog(`request ${this.activeRequest.id}: completed — ${summary}`);

      this.sendCli({
        type: 'agent-completed',
        requestId: this.activeRequest.id,
        filesEdited: files,
        summary,
      });
      this.sendBrowser({ type: 'reload-requested' });
    }

    this.activeRequest = null;
    await this.fileService.clearCompleted();
    await this.fileService.clearPending();
  }

  armTimeout() {
    this.clearTimeout();
    this.requestTimeout = setTimeout(() => {
      if (!this.activeRequest) return;
      console.log(`[Redev] Request ${this.activeRequest.id} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      this.sendCli({
        type: 'change-generated',
        error: `Timed out after ${REQUEST_TIMEOUT_MS / 60000} minutes. Did Claude Code see the request?`,
      });
      this.activeRequest = null;
      this.fileService.clearPending().catch(() => {});
    }, REQUEST_TIMEOUT_MS);
  }

  clearTimeout() {
    if (this.requestTimeout) {
      clearTimeout(this.requestTimeout);
      this.requestTimeout = null;
    }
  }

  async cancelRequest(reason) {
    this.clearTimeout();
    this.agentSpawner?.cancel();
    if (this.activeRequest) {
      await this.fileService.appendLog(`request ${this.activeRequest.id}: ${reason}`);
      this.activeRequest = null;
    }
    await this.fileService.clearPending();
  }

  sendCli(message) {
    this.wsServer.broadcastAll(message);
  }

  sendBrowser(message) {
    this.wsServer.broadcast(this.wsServer.browserClients, message);
  }
}
