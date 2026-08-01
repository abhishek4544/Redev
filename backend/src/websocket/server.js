import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { MESSAGE_TYPES, CLIENT_TYPES } from './protocol.js';

export class RedevWebSocketServer extends EventEmitter {
  constructor(port = 3001) {
    super();
    this.port = port;
    this.cliClients = new Set();
    this.browserClients = new Set();
    this.wss = null;
  }

  start() {
    this.wss = new WebSocketServer({ port: this.port });

    this.wss.on('connection', (ws, req) => {
      const url = new URL(req.url || '/', `http://localhost:${this.port}`);
      const clientType = url.searchParams.get('client');

      if (clientType === CLIENT_TYPES.CLI) {
        this.cliClients.add(ws);
        console.log(`[WS] CLI connected (total: ${this.cliClients.size})`);
        this.broadcast(this.browserClients, {
          type: MESSAGE_TYPES.CLI_CONNECTED,
        });
      } else if (clientType === CLIENT_TYPES.BROWSER) {
        this.browserClients.add(ws);
        console.log(`[WS] Browser connected (total: ${this.browserClients.size})`);
        this.broadcast(this.cliClients, {
          type: MESSAGE_TYPES.BROWSER_CONNECTED,
        });
      }

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.routeMessage(message, ws, clientType);
        } catch (err) {
          console.error('[WS] Invalid message:', err.message);
        }
      });

      ws.on('close', () => {
        this.cliClients.delete(ws);
        this.browserClients.delete(ws);
        console.log(`[WS] ${clientType} disconnected`);
      });

      ws.on('error', (err) => {
        console.error(`[WS] ${clientType} error:`, err.message);
      });
    });

    console.log(`Redev WebSocket server listening on ws://localhost:${this.port}`);
  }

  routeMessage(message, sender, clientType) {
    if (clientType === CLIENT_TYPES.BROWSER) {
      this.emit('browser-message', message);
      this.broadcast(this.cliClients, message);
    } else if (clientType === CLIENT_TYPES.CLI) {
      this.emit('cli-message', message);
      this.broadcast(this.browserClients, message);
    }
    this.emit('any-message', { source: clientType, message });
  }

  broadcastAll(message) {
    this.broadcast(this.cliClients, message);
    this.broadcast(this.browserClients, message);
  }

  broadcast(clients, message) {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
  }
}
