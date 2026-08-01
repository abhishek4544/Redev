import { spawn } from 'child_process';
import { existsSync } from 'fs';

export class AgentSpawner {
  constructor({ projectRoot, command = process.env.REDEV_AGENT_CMD || 'claude' } = {}) {
    this.projectRoot = projectRoot;
    this.command = command;
    this.child = null;
  }

  isEnabled() {
    return process.env.REDEV_AUTO_AGENT !== '0' && !!this.projectRoot;
  }

  spawnAgent(prompt, { onExit } = {}) {
    if (this.child) {
      console.warn('[AgentSpawner] Previous agent still running — killing it');
      try { this.child.kill('SIGTERM'); } catch {}
      this.child = null;
    }

    if (!existsSync(this.projectRoot)) {
      const err = new Error(`projectRoot does not exist: ${this.projectRoot}`);
      onExit?.({ code: -1, error: err.message });
      return;
    }

    const args = ['-p', prompt, '--dangerously-skip-permissions'];
    console.log(`[AgentSpawner] Spawning: ${this.command} ${args.slice(0,1).join(' ')} "..." ${args.slice(2).join(' ')} (cwd=${this.projectRoot})`);
    const child = spawn(this.command, args, {
      cwd: this.projectRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    this.child = child;

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      let friendly = err.message;
      if (err.code === 'ENOENT') {
        friendly = `Claude Code CLI ("${this.command}") not found on PATH. Install it from https://claude.com/claude-code, or set REDEV_AGENT_CMD to a different command.`;
      }
      console.error('[AgentSpawner] Failed to spawn agent:', friendly);
      this.child = null;
      onExit?.({ code: -1, error: friendly, stdout, stderr });
    });

    child.on('exit', (code) => {
      console.log(`[AgentSpawner] Agent exited with code ${code}`);
      if (stdout) console.log('[AgentSpawner] stdout tail:', stdout.slice(-500));
      if (stderr) console.log('[AgentSpawner] stderr tail:', stderr.slice(-500));
      this.child = null;
      onExit?.({ code, stdout, stderr });
    });
  }

  cancel() {
    if (this.child) {
      console.log('[AgentSpawner] Cancelling agent process');
      try { this.child.kill('SIGTERM'); } catch {}
      this.child = null;
    }
  }
}
