import { ConnectionType } from '../types';

export interface ConnectionTarget {
  connectionType: ConnectionType;
  address: string; // MAC for Bluetooth, Device path/VendorId for USB, IP:Port for Network
}

export interface IPrinterAdapter {
  readonly connectionType: ConnectionType;
  connect(address: string): Promise<boolean>;
  write(data: Uint8Array): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}
