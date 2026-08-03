import { IPrinterAdapter } from './IPrinterAdapter';
import { ConnectionType } from '../types';
import * as net from 'net';

/**
 * Android Network (Wi-Fi / Ethernet) Raw TCP Socket Adapter
 * Standard Port 9100 for Thermal & Standard Spool Printers
 */
export class NetworkAdapter implements IPrinterAdapter {
  public readonly connectionType: ConnectionType = 'Network';
  private socket: net.Socket | null = null;
  private connectedHost: string | null = null;
  private socketConnected = false;

  public async connect(address: string): Promise<boolean> {
    // address format: "192.168.1.100:9100" or "192.168.1.100" (default port 9100)
    const [ip, portStr] = address.split(':');
    const port = portStr ? parseInt(portStr, 10) : 9100;

    return new Promise((resolve, reject) => {
      try {
        console.log(`[NetworkAdapter] Opening TCP Socket to ${ip}:${port}...`);
        this.socket = new net.Socket();
        this.socket.setTimeout(5000); // 5s connection timeout

        this.socket.connect(port, ip, () => {
          this.socketConnected = true;
          this.connectedHost = address;
          console.log(`[NetworkAdapter] TCP Socket connected to ${ip}:${port}`);
          resolve(true);
        });

        this.socket.on('error', (err) => {
          console.error(`[NetworkAdapter] TCP Socket error on ${address}:`, err);
          this.socketConnected = false;
          this.cleanupSocket();
          reject(err);
        });

        this.socket.on('timeout', () => {
          console.error(`[NetworkAdapter] Connection timeout to ${address}`);
          this.socketConnected = false;
          this.cleanupSocket();
          reject(new Error(`TCP Socket connection timeout to ${address}`));
        });

        this.socket.on('close', () => {
          console.log(`[NetworkAdapter] Socket closed for ${address}`);
          this.socketConnected = false;
        });

      } catch (err) {
        console.error(`[NetworkAdapter] Failed to initialize socket for ${address}:`, err);
        this.socketConnected = false;
        reject(err);
      }
    });
  }

  public async write(data: Uint8Array): Promise<void> {
    if (!this.socketConnected || !this.socket) {
      throw new Error('[NetworkAdapter] Cannot write: TCP Socket is not connected.');
    }

    return new Promise((resolve, reject) => {
      console.log(`[NetworkAdapter] Writing ${data.length} bytes to TCP Socket ${this.connectedHost}`);
      const buffer = Buffer.from(data);
      this.socket?.write(buffer, (err) => {
        if (err) {
          console.error('[NetworkAdapter] TCP Write error:', err);
          reject(err);
        } else {
          console.log('[NetworkAdapter] Data successfully written to TCP Socket.');
          resolve();
        }
      });
    });
  }

  public async disconnect(): Promise<void> {
    if (this.socket) {
      console.log(`[NetworkAdapter] Disconnecting TCP Socket ${this.connectedHost}`);
      this.socket.destroy();
      this.cleanupSocket();
    }
  }

  private cleanupSocket(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket = null;
    }
    this.socketConnected = false;
    this.connectedHost = null;
  }

  public isConnected(): boolean {
    return this.socketConnected;
  }
}
