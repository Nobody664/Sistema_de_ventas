'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { BarcodeScannerService } from '@/components/scanner/services/barcode-scanner.service';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScannerOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const serviceRef = useRef<BarcodeScannerService | null>(null);

  useEffect(() => {
    const service = new BarcodeScannerService();
    serviceRef.current = service;

    const unsubStatus = service.onStatus(setIsConnected);
    const unsubScan = service.onScan(onScan);

    if (enabled) {
      service.start();
    }

    return () => {
      unsubStatus();
      unsubScan();
      service.stop();
      serviceRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!serviceRef.current) return;
    if (enabled) {
      serviceRef.current.start();
    } else {
      serviceRef.current.stop();
    }
  }, [enabled]);

  return { isConnected };
}
