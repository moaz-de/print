/**
 * Shared Type Definitions for Remote Print Management System
 * Platform: Android & Windows TypeScript Agents / Cloud Server
 */

export type PlatformType = 'Windows' | 'Android';
export type ConnectionType = 'USB' | 'Bluetooth' | 'Network';
export type PrinterType = 'thermal' | 'standard';
export type SupportedMode = 'RAW_ESC_POS' | 'SILENT_PDF';

export interface PrinterDevice {
  printer_id: string;
  name: string;
  type: PrinterType;
  connection: ConnectionType;
  address?: string; // MAC Address for BT, IP/Port for Network, Device Path for USB
  is_default: boolean;
  supported_modes: SupportedMode[];
}

export interface PrinterDiscoveryEvent {
  event: 'PRINTER_DISCOVERY';
  agent_id: string;
  platform: PlatformType;
  status: 'online' | 'offline' | 'error';
  printers: PrinterDevice[];
}

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
}

export interface ThermalReceiptData {
  store_name: string;
  header_lines?: string[];
  items: ReceiptItem[];
  total: number;
  currency_symbol?: string;
  footer?: string;
}

export interface ThermalOptions {
  auto_cut?: boolean;
  open_cash_drawer?: boolean;
}

export interface ThermalPrintJobDispatch {
  event: 'PRINT_JOB_DISPATCH';
  job_id: string;
  target_printer_id: string;
  content_type: 'raw_json';
  options?: ThermalOptions;
  data: ThermalReceiptData;
}

export interface PdfOptions {
  copies?: number;
  orientation?: 'portrait' | 'landscape';
}

export interface PdfPrintJobDispatch {
  event: 'PRINT_JOB_DISPATCH';
  job_id: string;
  target_printer_id: string;
  content_type: 'pdf_base64';
  options?: PdfOptions;
  payload_base64: string;
}

export type PrintJobDispatch = ThermalPrintJobDispatch | PdfPrintJobDispatch;

export interface PrintJobStatusEvent {
  event: 'PRINT_JOB_STATUS';
  job_id: string;
  agent_id: string;
  status: 'RECEIVED' | 'PRINTING' | 'COMPLETED' | 'FAILED';
  error_message?: string;
  timestamp: string;
}

export interface AgentConfig {
  cloud_url: string; // e.g. wss://print.domain.com/ws/agent
  agent_id: string;
  api_key: string;
  reconnect_interval_ms?: number;
  ping_interval_ms?: number;
}
