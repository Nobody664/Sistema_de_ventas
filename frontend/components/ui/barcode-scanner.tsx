'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Loader2, X } from 'lucide-react';

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
}

const FORMATS: BarcodeFormat[] = [
  'ean_13', 'ean_8', 'code_128', 'code_39',
  'upc_a', 'upc_e', 'codabar', 'itf',
];

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const detectingRef = useRef(false);

  useEffect(() => {
    if (!('BarcodeDetector' in window)) {
      setSupported(false);
      return;
    }
    BarcodeDetector.getSupportedFormats().then((available) => {
      const supportedFormats = FORMATS.filter((f) => available.includes(f));
      if (supportedFormats.length === 0) {
        setSupported(false);
        return;
      }
      detectorRef.current = new BarcodeDetector({ formats: supportedFormats });
    });
  }, []);

  const stopCamera = useCallback(() => {
    detectingRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setOpen(false);
    setError(null);
  }, []);

  const startScanning = useCallback(async () => {
    setError(null);
    setOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectingRef.current = true;
      const detect = async () => {
        if (!detectingRef.current || !detectorRef.current || !videoRef.current) return;
        try {
          const barcodes = await detectorRef.current.detect(videoRef.current);
          if (barcodes.length > 0) {
            onDetected(barcodes[0].rawValue);
            stopCamera();
            return;
          }
        } catch {
          // detection frame error, keep going
        }
        if (detectingRef.current) requestAnimationFrame(detect);
      };
      detect();
    } catch {
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
      setOpen(false);
    }
  }, [onDetected, stopCamera]);

  useEffect(() => {
    return () => {
      detectingRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  if (!supported) {
    return (
      <p className="text-xs text-amber-600">
        Escáner no disponible en este navegador. Usa Chrome o Edge.
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={startScanning}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
        title="Escanear código de barras"
      >
        <Camera className="size-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-medium text-white/70">Escanea el código de barras</span>
            <button
              type="button"
              onClick={stopCamera}
              className="flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Viewfinder */}
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="relative w-full max-w-sm overflow-hidden rounded-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover"
              />
              {/* Scan area overlay */}
              <div className="absolute inset-[15%] rounded-xl border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
              <div className="absolute left-[15%] right-[15%] top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
            </div>
          </div>

          {/* Footer */}
          <div className="px-4 pb-8 text-center">
            <p className="text-sm text-white/50">Alinea el código de barras dentro del recuadro</p>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
