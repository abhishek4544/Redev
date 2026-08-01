import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export class RedevWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(port = 3001) {
    super();
    this.url = `ws://localhost:${port}?client=cli`;
  }

  connect(): void {
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      this.emit('connected');
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.emit('message', message);
        this.emit(message.type, message);
      } catch (err) {
        this.emit('error', new Error(`Invalid message: ${(err as Error).message}`));
      }
    });

    this.ws.on('close', () => {
      this.emit('disconnected');
      if (!this.isShuttingDown) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      this.emit('connection-error', err);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 2000);
  }

  send(message: WSMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  disconnect(): void {
    this.isShuttingDown = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
