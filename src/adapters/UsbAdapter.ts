import { IPrinterAdapter } from './IPrinterAdapter';
import { ConnectionType } from '../types';

/**
 * Android USB Host OTG Thermal Printer Adapter
 * Communicates directly with USB Printer Endpoint (Class 0x07 Printer)
 */
export class UsbAdapter implements IPrinterAdapter {
  public readonly connectionType: ConnectionType = 'USB';
  private connectedDeviceId: string | null = null;
  private deviceConnected = false;

  private nativeUsbBridge: any;

  constructor(nativeUsbBridge?: any) {
    this.nativeUsbBridge = nativeUsbBridge || (globalThis as any).RNUsbPrinter;
  }

  public async connect(deviceAddress: string): Promise<boolean> {
    try {
      console.log(`[UsbAdapter] Connecting to USB Device: ${deviceAddress}...`);
      
      // deviceAddress format: "vendorId:productId" or "usb_path"
      if (this.nativeUsbBridge) {
        const [vendorId, productId] = deviceAddress.split(':').map(Number);
        await this.nativeUsbBridge.requestPermission(vendorId, productId);
        const success = await this.nativeUsbBridge.connect(vendorId, productId);
        this.deviceConnected = success;
      } else {
        console.warn('[UsbAdapter] Native USB Bridge not found, operating in simulated USB OTG mode.');
        this.deviceConnected = true;
      }

      if (this.deviceConnected) {
        this.connectedDeviceId = deviceAddress;
        console.log(`[UsbAdapter] Connected to USB Printer: ${deviceAddress}`);
        return true;
      }
      return false;
    } catch (err) {
      console.error(`[UsbAdapter] Failed to connect to USB device ${deviceAddress}:`, err);
      this.deviceConnected = false;
      this.connectedDeviceId = null;
      throw err;
    }
  }

  public async write(data: Uint8Array): Promise<void> {
    if (!this.deviceConnected || !this.connectedDeviceId) {
      throw new Error('[UsbAdapter] Cannot write: USB printer is not connected.');
    }

    try {
      console.log(`[UsbAdapter] Transmitting ${data.length} bytes to USB Device ${this.connectedDeviceId}`);
      if (this.nativeUsbBridge) {
        const base64Data = Buffer.from(data).toString('base64');
        await this.nativeUsbBridge.writeRawData(base64Data);
      } else {
        console.log(`[UsbAdapter] Simulated USB Bulk Transfer: ${data.length} bytes sent.`);
      }
    } catch (err) {
      console.error('[UsbAdapter] USB Bulk Transfer failed:', err);
      throw err;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.connectedDeviceId) {
      try {
        if (this.nativeUsbBridge) {
          await this.nativeUsbBridge.close();
        }
        console.log(`[UsbAdapter] Closed USB connection to ${this.connectedDeviceId}`);
      } catch (err) {
        console.error('[UsbAdapter] Error closing USB connection:', err);
      } finally {
        this.deviceConnected = false;
        this.connectedDeviceId = null;
      }
    }
  }

  public isConnected(): boolean {
    return this.deviceConnected;
  }
}
