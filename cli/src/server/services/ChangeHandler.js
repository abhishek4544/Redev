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
    const pendingElement = this.pendingElement;
    if (!pendingElement) {
      this.sendCli({
        type: 'change-generated',
        error: 'No element selected. Click an element in the browser first.',
      });
      return;
    }

    const requestedScope = message.editScope;
    const editScope = requestedScope === 'component' || requestedScope === 'instance'
      ? requestedScope
      : pendingElement.editScope === 'component' || pendingElement.editScope === 'instance'
        ? pendingElement.editScope
        : pendingElement.componentScopeAvailable ? 'component' : 'instance';
    const element = { ...pendingElement, editScope };

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
    const fileKnown = element.file && element.file !== 'unknown';
    const textHint = element.text ? `**Visible text:** "${String(element.text).slice(0, 120)}"` : null;
    const xpathHint = element.xpath ? `**XPath:** ${element.xpath}` : null;
    const sharedComponentScope = element.editScope === 'component' && element.componentScopeAvailable;
    const scopeHint = sharedComponentScope
      ? `**Edit scope:** Shared component. Update the ${element.component} source so every instance of it receives this change. Do not add a one-off override at only the clicked usage.`
      : `**Edit scope:** This instance only. Apply a local override at the clicked usage and do not change reusable component defaults.`;

    const locate = fileKnown
      ? [
          `**File (from redev-vite-plugin):** ${element.file}:${element.line}`,
          '',
          `Steps to satisfy this request:`,
          `1. Read ${element.file}`,
          `2. Locate the element at line ${element.line} (matches the tag and classes above)`,
        ]
      : [
          `**File:** not known — the app has no redev-vite-plugin (Next.js / Remix / CRA / plain React).`,
          '',
          `Steps to satisfy this request:`,
          `1. Search the codebase for the element. Best signals in order: visible text → unique class combo → tag + parent structure. Try Grep for the text first.`,
          `2. When you find a candidate file, confirm by reading it and matching against the element hints above. If unsure, ask the user by writing completed.json with an "error" field.`,
        ];

    return [
      `A user clicked a UI element in their running app and asked for a change.`,
      ``,
      `**Target element:** <${element.tagName}>`,
      `**Enclosing component:** ${element.component || '(unknown)'}`,
      `**Current classes:** ${(element.classes || []).join(' ') || '(none)'}`,
      scopeHint,
      textHint,
      xpathHint,
      ``,
      `**User request:** "${prompt}"`,
      ``,
      ...locate,
      `3. Make the minimal edit that satisfies the request. Prefer Tailwind utilities if the file already uses them. Preserve existing formatting, imports, and component structure.`,
      `4. Preferred: use the redev MCP tool \`apply_change\` with a one-line summary and the list of files edited — it clears the pending state and reloads the browser.`,
      `5. Fallback (drop-box mode, no MCP): write .redev/completed.json in the project root with { id, completed_at, files_edited, summary }.`,
      `6. If you cannot satisfy the request (ambiguous, out of scope), use the redev MCP tool \`report_error\` — or write completed.json with an "error" field.`,
    ].filter(Boolean).join('\n');
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

  async completeFromMcp({ summary, files_edited }) {
    if (!this.activeRequest) {
      return { ok: false, error: 'No active request. Ask the user to click an element and submit a prompt in the browser panel first.' };
    }
    const requestId = this.activeRequest.id;
    this.clearTimeout();
    this.agentSpawner?.cancel();
    await this.fileService.appendLog(`request ${requestId}: completed via MCP — ${summary}`);
    this.sendCli({
      type: 'agent-completed',
      requestId,
      filesEdited: files_edited || [],
      summary,
    });
    this.sendBrowser({ type: 'reload-requested' });
    this.activeRequest = null;
    await this.fileService.clearPending();
    await this.fileService.clearCompleted();
    return { ok: true, requestId, summary, filesEdited: files_edited || [] };
  }

  async failFromMcp(errorMessage) {
    if (!this.activeRequest) {
      return { ok: false, error: 'No active request.' };
    }
    const requestId = this.activeRequest.id;
    this.clearTimeout();
    this.agentSpawner?.cancel();
    await this.fileService.appendLog(`request ${requestId}: MCP error — ${errorMessage}`);
    this.sendCli({ type: 'change-generated', error: `Agent could not complete: ${errorMessage}` });
    this.activeRequest = null;
    await this.fileService.clearPending();
    return { ok: true, requestId, error: errorMessage };
  }

  sendCli(message) {
    this.wsServer.broadcastAll(message);
  }

  sendBrowser(message) {
    this.wsServer.broadcast(this.wsServer.browserClients, message);
  }
}
