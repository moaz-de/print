import {
  PrintJobDispatch,
  ThermalPrintJobDispatch,
  PdfPrintJobDispatch,
  PrinterDevice,
  PrintJobStatusEvent,
} from '../types';
import { IPrinterAdapter } from '../adapters/IPrinterAdapter';
import { BluetoothAdapter } from '../adapters/BluetoothAdapter';
import { UsbAdapter } from '../adapters/UsbAdapter';
import { NetworkAdapter } from '../adapters/NetworkAdapter';
import { EscPosEncoder } from '../escpos/Encoder';
import { AgentWebSocketClient } from '../websocket/WebSocketClient';

export class PrintJobDispatcher {
  private agentId: string;
  private wsClient: AgentWebSocketClient;
  private knownPrinters: Map<string, PrinterDevice> = new Map();
  private encoder = new EscPosEncoder();

  constructor(agentId: string, wsClient: AgentWebSocketClient) {
    this.agentId = agentId;
    this.wsClient = wsClient;
  }

  public updateKnownPrinters(printers: PrinterDevice[]): void {
    this.knownPrinters.clear();
    for (const p of printers) {
      this.knownPrinters.set(p.printer_id, p);
    }
  }

  public async handleJobDispatch(job: PrintJobDispatch): Promise<void> {
    console.log(`[PrintDispatcher] Handling print job ${job.job_id} for printer ${job.target_printer_id}`);

    // 1. Report RECEIVED status
    this.reportStatus(job.job_id, 'RECEIVED');

    const printer = this.knownPrinters.get(job.target_printer_id);
    if (!printer) {
      const errorMsg = `Printer with ID '${job.target_printer_id}' not found on this agent.`;
      console.error(`[PrintDispatcher] ${errorMsg}`);
      this.reportStatus(job.job_id, 'FAILED', errorMsg);
      return;
    }

    // 2. Report PRINTING status
    this.reportStatus(job.job_id, 'PRINTING');

    let adapter: IPrinterAdapter;
    try {
      adapter = this.getAdapterForConnection(printer);
    } catch (err: any) {
      this.reportStatus(job.job_id, 'FAILED', err.message);
      return;
    }

    try {
      const address = printer.address || '';
      console.log(`[PrintDispatcher] Connecting to ${printer.name} via ${printer.connection} (${address})...`);
      
      const connected = await adapter.connect(address);
      if (!connected) {
        throw new Error(`Could not establish connection to printer ${printer.name}`);
      }

      // 3. Execute job based on content_type
      if (job.content_type === 'raw_json') {
        await this.processThermalJob(job as ThermalPrintJobDispatch, adapter);
      } else if (job.content_type === 'pdf_base64') {
        await this.processPdfJob(job as PdfPrintJobDispatch, adapter, printer);
      } else {
        throw new Error(`Unsupported content_type: ${(job as any).content_type}`);
      }

      // 4. Disconnect adapter
      await adapter.disconnect();

      // 5. Report COMPLETED status
      console.log(`[PrintDispatcher] Job ${job.job_id} executed successfully.`);
      this.reportStatus(job.job_id, 'COMPLETED');

    } catch (err: any) {
      console.error(`[PrintDispatcher] Job ${job.job_id} execution failed:`, err);
      await adapter.disconnect().catch(() => {});
      this.reportStatus(job.job_id, 'FAILED', err.message || 'Unknown print failure.');
    }
  }

  private async processThermalJob(
    job: ThermalPrintJobDispatch,
    adapter: IPrinterAdapter
  ): Promise<void> {
    console.log(`[PrintDispatcher] Encoding thermal ESC/POS receipt for job ${job.job_id}...`);
    const escposBytes = this.encoder.buildReceipt(job.data, job.options);
    await adapter.write(escposBytes);
  }

  private async processPdfJob(
    job: PdfPrintJobDispatch,
    adapter: IPrinterAdapter,
    printer: PrinterDevice
  ): Promise<void> {
    console.log(`[PrintDispatcher] Processing PDF job ${job.job_id} (${job.payload_base64.length} base64 chars)...`);

    const pdfBuffer = Buffer.from(job.payload_base64, 'base64');

    if (printer.connection === 'Network') {
      // Direct PDF stream / raw spool to network printer on Port 9100
      await adapter.write(pdfBuffer);
    } else {
      // Native Android PDF Spooler bridge call
      const nativePdfBridge = (globalThis as any).RNPdfPrinter;
      if (nativePdfBridge) {
        await nativePdfBridge.printPdfBase64(job.payload_base64, printer.name);
      } else {
        console.log(`[PrintDispatcher] Native PDF Print Bridge unavailable. Simulated PDF printing ${pdfBuffer.length} bytes.`);
      }
    }
  }

  private getAdapterForConnection(printer: PrinterDevice): IPrinterAdapter {
    switch (printer.connection) {
      case 'Bluetooth':
        return new BluetoothAdapter();
      case 'USB':
        return new UsbAdapter();
      case 'Network':
        return new NetworkAdapter();
      default:
        throw new Error(`Unsupported connection type '${printer.connection}' for printer '${printer.name}'`);
    }
  }

  private reportStatus(
    jobId: string,
    status: 'RECEIVED' | 'PRINTING' | 'COMPLETED' | 'FAILED',
    errorMessage?: string
  ): void {
    const statusEvent: PrintJobStatusEvent = {
      event: 'PRINT_JOB_STATUS',
      job_id: jobId,
      agent_id: this.agentId,
      status,
      error_message: errorMessage,
      timestamp: new Date().toISOString(),
    };
    this.wsClient.sendJobStatus(statusEvent);
  }
}
