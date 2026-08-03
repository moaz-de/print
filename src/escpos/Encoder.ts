import { ThermalReceiptData, ThermalOptions } from '../types';

export class EscPosEncoder {
  private buffer: number[] = [];
  private static readonly CHARS_PER_LINE = 32; // Standard 58mm thermal paper line width

  // Control Codes
  private static readonly ESC = 0x1B;
  private static readonly GS = 0x1D;

  public reset(): this {
    this.buffer = [];
    return this;
  }

  public init(): this {
    this.buffer.push(EscPosEncoder.ESC, 0x40); // ESC @
    return this;
  }

  public alignLeft(): this {
    this.buffer.push(EscPosEncoder.ESC, 0x61, 0x00);
    return this;
  }

  public alignCenter(): this {
    this.buffer.push(EscPosEncoder.ESC, 0x61, 0x01);
    return this;
  }

  public alignRight(): this {
    this.buffer.push(EscPosEncoder.ESC, 0x61, 0x02);
    return this;
  }

  public setBold(enable: boolean): this {
    this.buffer.push(EscPosEncoder.ESC, 0x45, enable ? 0x01 : 0x00);
    return this;
  }

  public setDoubleSize(enable: boolean): this {
    this.buffer.push(EscPosEncoder.GS, 0x21, enable ? 0x11 : 0x00);
    return this;
  }

  public text(str: string): this {
    const encoder = new TextEncoder();
    const bytes = Array.from(encoder.encode(str));
    this.buffer.push(...bytes);
    return this;
  }

  public lineFeed(count = 1): this {
    for (let i = 0; i < count; i++) {
      this.buffer.push(0x0A);
    }
    return this;
  }

  public printLine(str: string): this {
    return this.text(str).lineFeed();
  }

  public printDivider(char = '-'): this {
    const divider = char.repeat(EscPosEncoder.CHARS_PER_LINE);
    return this.printLine(divider);
  }

  public printTwoColumn(left: string, right: string): this {
    const maxLeftLen = EscPosEncoder.CHARS_PER_LINE - right.length - 1;
    let truncatedLeft = left;
    if (truncatedLeft.length > maxLeftLen) {
      truncatedLeft = truncatedLeft.substring(0, maxLeftLen);
    }
    const spaces = ' '.repeat(EscPosEncoder.CHARS_PER_LINE - truncatedLeft.length - right.length);
    return this.printLine(truncatedLeft + spaces + right);
  }

  public openCashDrawer(): this {
    // Drawer Kick: ESC p 0 25 250 (0x1B 0x70 0x00 0x19 0xFA)
    this.buffer.push(0x1B, 0x70, 0x00, 0x19, 0xFA);
    return this;
  }

  public paperCut(): this {
    // Cut Command: GS V 0 (0x1D 0x56 0x00)
    this.buffer.push(0x1D, 0x56, 0x00);
    return this;
  }

  public buildReceipt(data: ThermalReceiptData, options?: ThermalOptions): Uint8Array {
    this.init();

    // 1. Header & Store Name
    this.alignCenter();
    this.setBold(true);
    this.setDoubleSize(true);
    this.printLine(data.store_name);
    this.setDoubleSize(false);

    if (data.header_lines && data.header_lines.length > 0) {
      this.setBold(false);
      for (const line of data.header_lines) {
        this.printLine(line);
      }
    }
    this.lineFeed();

    // 2. Items Table
    this.alignLeft();
    this.printDivider('=');
    this.setBold(true);
    this.printTwoColumn('Item (Qty x Price)', 'Total');
    this.setBold(false);
    this.printDivider('-');

    const currency = data.currency_symbol || '$';
    for (const item of data.items) {
      const itemTotal = (item.qty * item.price).toFixed(2);
      const leftDesc = `${item.name} (${item.qty}x${item.price.toFixed(2)})`;
      const rightVal = `${currency}${itemTotal}`;
      this.printTwoColumn(leftDesc, rightVal);
    }

    this.printDivider('=');

    // 3. Total
    this.alignRight();
    this.setBold(true);
    this.setDoubleSize(true);
    this.printLine(`TOTAL: ${currency}${data.total.toFixed(2)}`);
    this.setDoubleSize(false);
    this.setBold(false);
    this.lineFeed();

    // 4. Footer
    if (data.footer) {
      this.alignCenter();
      this.printLine(data.footer);
      this.lineFeed();
    }

    // 5. Margin Feeds
    this.lineFeed(3);

    // 6. Options: Open Drawer & Cut Paper
    if (options?.open_cash_drawer) {
      this.openCashDrawer();
    }

    if (options?.auto_cut ?? true) {
      this.paperCut();
    }

    return new Uint8Array(this.buffer);
  }
}
