import { IPrinterAdapter } from './IPrinterAdapter';
import { ConnectionType } from '../types';

/**
 * Android Bluetooth Classic (SPP) Thermal Printer Adapter
 * Uses RFCOMM Socket UUID 00001101-0000-1000-8000-00805F9B34FB
 */
export class BluetoothAdapter implements IPrinterAdapter {
  public readonly connectionType: ConnectionType = 'Bluetooth';
  private connectedAddress: string | null = null;
  private socketConnected = false;

  // Native Bridge interface placeholder for react-native-bluetooth-classic
  private nativeBtBridge: any;

  constructor(nativeBtBridge?: any) {
    this.nativeBtBridge = nativeBtBridge || (globalThis as any).RNBluetoothClassic;
  }

  public async connect(macAddress: string): Promise<boolean> {
    try {
      console.log(`[BluetoothAdapter] Connecting to BT MAC: ${macAddress}...`);
      if (this.nativeBtBridge) {
        const device = await this.nativeBtBridge.connectToDevice(macAddress, {
          delimiter: '\n',
          charset: 'utf-8',
        });
        this.socketConnected = await device.isConnected();
      } else {
        // Fallback / Mock Socket simulation for non-native test environments
        console.warn('[BluetoothAdapter] Native BT Bridge not found, operating in simulated socket mode.');
        this.socketConnected = true;
      }

      if (this.socketConnected) {
        this.connectedAddress = macAddress;
        console.log(`[BluetoothAdapter] Connected successfully to ${macAddress}`);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`[BluetoothAdapter] Failed to connect to ${macAddress}:`, err);
      this.socketConnected = false;
      this.connectedAddress = null;
      throw err;
    }
  }

  public async write(data: Uint8Array): Promise<void> {
    if (!this.socketConnected || !this.connectedAddress) {
      throw new Error('[BluetoothAdapter] Cannot write: Bluetooth socket is not connected.');
    }

    try {
      console.log(`[BluetoothAdapter] Writing ${data.length} bytes to BT device ${this.connectedAddress}`);
      if (this.nativeBtBridge) {
        // Convert Uint8Array to Base64 or Hex for Native Bridge transfer
        const base64Data = Buffer.from(data).toString('base64');
        await this.nativeBtBridge.writeToDevice(this.connectedAddress, base64Data, 'base64');
      } else {
        console.log(`[BluetoothAdapter] Simulated write: ${data.length} bytes sent.`);
      }
    } catch (err) {
      console.error('[BluetoothAdapter] Write failed:', err);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.connectedAddress) {
      try {
        if (this.nativeBtBridge) {
          await this.nativeBtBridge.disconnectFromDevice(this.connectedAddress);
        }
        console.log(`[BluetoothAdapter] Disconnected from ${this.connectedAddress}`);
      } catch (err) {
        console.error('[BluetoothAdapter] Error during disconnect:', err);
      } finally {
        this.socketConnected = false;
        this.connectedAddress = null;
      }
    }
  }

  public isConnected(): boolean {
    return this.socketConnected;
  }
}
