type ScanCallback = (code: string) => void;
type StatusCallback = (connected: boolean) => void;
type ErrorCallback = (error: string) => void;

interface BarcodeScannerConfig {
  scanThreshold?: number;
  bufferTimeout?: number;
  trimSuffix?: boolean;
  allowedKeys?: RegExp;
  maxLength?: number;
}

const DEFAULT_CONFIG: Required<BarcodeScannerConfig> = {
  scanThreshold: 30,
  bufferTimeout: 200,
  trimSuffix: true,
  allowedKeys: /^[0-9]$/,
  maxLength: 48,
};

export class BarcodeScannerService {
  private buffer: string[] = [];
  private timestamps: number[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private config: Required<BarcodeScannerConfig>;
  private boundHandler: ((e: KeyboardEvent) => void) | null = null;
  private isListening = false;
  private _connected = false;

  private onScanCallbacks: ScanCallback[] = [];
  private onStatusCallbacks: StatusCallback[] = [];
  private onErrorCallbacks: ErrorCallback[] = [];

  constructor(config?: BarcodeScannerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get connected(): boolean {
    return this._connected;
  }

  onScan(cb: ScanCallback): () => void {
    this.onScanCallbacks.push(cb);
    return () => {
      this.onScanCallbacks = this.onScanCallbacks.filter((f) => f !== cb);
    };
  }

  onStatus(cb: StatusCallback): () => void {
    this.onStatusCallbacks.push(cb);
    return () => {
      this.onStatusCallbacks = this.onStatusCallbacks.filter((f) => f !== cb);
    };
  }

  onError(cb: ErrorCallback): () => void {
    this.onErrorCallbacks.push(cb);
    return () => {
      this.onErrorCallbacks = this.onErrorCallbacks.filter((f) => f !== cb);
    };
  }

  start(): void {
    if (this.isListening) return;
    this.isListening = true;
    this.boundHandler = this.handleKeydown.bind(this);
    document.addEventListener('keydown', this.boundHandler);
    this.setConnected(true);
  }

  stop(): void {
    if (!this.isListening) return;
    this.isListening = false;
    if (this.boundHandler) {
      document.removeEventListener('keydown', this.boundHandler);
      this.boundHandler = null;
    }
    this.flushBuffer();
    this.setConnected(false);
  }

  private handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      this.finalizeScan();
      return;
    }

    if (e.ctrlKey || e.altKey || e.metaKey) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      this.finalizeScan();
      return;
    }

    if (e.key === 'Escape') {
      this.flushBuffer();
      return;
    }

    if (this.config.allowedKeys.test(e.key)) {
      e.preventDefault();
      this.buffer.push(e.key);
      this.timestamps.push(performance.now());
      this.resetFlushTimer();

      if (this.buffer.length >= this.config.maxLength) {
        this.finalizeScan();
      }
    }
  }

  private resetFlushTimer(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      if (this.isScannerInput()) {
        this.finalizeScan();
      } else {
        this.flushBuffer();
      }
    }, this.config.bufferTimeout);
  }

  private isScannerInput(): boolean {
    if (this.timestamps.length < 3) return false;

    for (let i = 1; i < this.timestamps.length; i++) {
      const gap = this.timestamps[i] - this.timestamps[i - 1];
      if (gap > this.config.scanThreshold) return false;
    }
    return true;
  }

  private finalizeScan(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const raw = this.buffer.join('');
    this.flushBuffer();

    if (raw.length < 3) return;

    const code = this.config.trimSuffix ? raw.replace(/[\s\r\n]+$/, '') : raw;

    if (this.isScannerInput()) {
      this.onScanCallbacks.forEach((cb) => cb(code));
    }
  }

  private flushBuffer(): void {
    this.buffer = [];
    this.timestamps = [];
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private setConnected(value: boolean): void {
    if (this._connected !== value) {
      this._connected = value;
      this.onStatusCallbacks.forEach((cb) => cb(value));
    }
  }
}
