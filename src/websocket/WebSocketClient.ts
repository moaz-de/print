import WebSocket from 'ws';
import { AgentConfig, PrintJobDispatch, PrintJobStatusEvent } from '../types';

export type MessageHandler = (message: PrintJobDispatch) => Promise<void>;

export class AgentWebSocketClient {
  private ws: WebSocket | null = null;
  private config: AgentConfig;
  private isConnecting = false;
  private isManuallyClosed = false;
  private reconnectAttempts = 0;
  private maxReconnectDelayMs = 30000;
  private pingIntervalTimer: NodeJS.Timeout | null = null;
  private onPrintJobHandler: MessageHandler | null = null;
  private onConnectCallback: (() => void) | null = null;

  constructor(config: AgentConfig) {
    this.config = {
      reconnect_interval_ms: 3000,
      ping_interval_ms: 15000,
      ...config,
    };
  }

  public setPrintJobHandler(handler: MessageHandler): void {
    this.onPrintJobHandler = handler;
  }

  public setConnectCallback(callback: () => void): void {
    this.onConnectCallback = callback;
  }

  public connect(): void {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    this.isManuallyClosed = false;

    console.log(`[WebSocketClient] Connecting to Central Cloud: ${this.config.cloud_url}`);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.api_key}`,
      'X-Agent-ID': this.config.agent_id,
      'X-Client-Platform': 'Android',
    };

    try {
      this.ws = new WebSocket(this.config.cloud_url, { headers });

      this.ws.on('open', () => {
        console.log('[WebSocketClient] Persistent WSS Connection Established Successfully!');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();

        if (this.onConnectCallback) {
          this.onConnectCallback();
        }
      });

      this.ws.on('message', async (raw: WebSocket.Data) => {
        try {
          const payloadStr = raw.toString();
          console.log('[WebSocketClient] Received Cloud Dispatch:', payloadStr.substring(0, 150));
          const parsed = JSON.parse(payloadStr);

          if (parsed.event === 'PRINT_JOB_DISPATCH' && this.onPrintJobHandler) {
            await this.onPrintJobHandler(parsed as PrintJobDispatch);
          } else if (parsed.event === 'PONG') {
            console.log('[WebSocketClient] Heartbeat PONG received.');
          }
        } catch (err) {
          console.error('[WebSocketClient] Failed to process incoming message:', err);
        }
      });

      this.ws.on('error', (err) => {
        console.error('[WebSocketClient] WebSocket Error:', err.message);
        this.isConnecting = false;
      });

      this.ws.on('close', (code, reason) => {
        console.warn(`[WebSocketClient] Connection Closed (Code: ${code}, Reason: ${reason})`);
        this.isConnecting = false;
        this.stopHeartbeat();

        if (!this.isManuallyClosed) {
          this.scheduleReconnect();
        }
      });
    } catch (err) {
      console.error('[WebSocketClient] Exception during connection initiation:', err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  public send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      this.ws.send(payload);
    } else {
      console.error('[WebSocketClient] Cannot send: WebSocket is not in OPEN state.');
    }
  }

  public sendJobStatus(statusEvent: PrintJobStatusEvent): void {
    this.send(statusEvent);
  }

  public disconnect(): void {
    this.isManuallyClosed = true;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    console.log('[WebSocketClient] Manually disconnected.');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ event: 'PING', timestamp: new Date().toISOString() }));
      }
    }, this.config.ping_interval_ms);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalTimer) {
      clearInterval(this.pingIntervalTimer);
      this.pingIntervalTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    // Exponential backoff with jitter
    const delay = Math.min(
      (this.config.reconnect_interval_ms || 3000) * Math.pow(1.5, this.reconnectAttempts),
      this.maxReconnectDelayMs
    );

    console.log(`[WebSocketClient] Scheduling reconnect attempt #${this.reconnectAttempts} in ${Math.round(delay)} ms...`);
    setTimeout(() => {
      if (!this.isManuallyClosed) {
        this.connect();
      }
    }, delay);
  }
}
