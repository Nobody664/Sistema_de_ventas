"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ImagePlus,
  Loader2,
  ScanLine,
  Zap,
  ZapOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  createBarcodeDecoder,
  type BarcodeDecoder,
  type ScanResult,
} from "@/lib/barcode/decoder";
import {
  scannerCanvas,
  scannerImage,
  SCANNER_IMAGE_TYPES,
} from "@/lib/barcode/image";

export type { ScanResult } from "@/lib/barcode/decoder";

interface BarcodeScannerProps {
  onDetected: (result: ScanResult) => void;
}

function cameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError")
      return "No se autorizó la cámara. Habilita el permiso o elige una imagen de tu galería.";
    if (error.name === "NotFoundError")
      return "No se encontró una cámara. Puedes leer una imagen de tu galería.";
    if (error.name === "NotReadableError")
      return "La cámara está ocupada. Cierra otras aplicaciones e inténtalo de nuevo.";
  }
  return "No se pudo iniciar la cámara. Inténtalo de nuevo o elige una imagen.";
}

export function BarcodeScanner({ onDetected }: BarcodeScannerProps) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"idle" | "starting" | "camera" | "image">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchPending, setTorchPending] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decoderRef = useRef<Promise<BarcodeDecoder> | null>(null);
  const sessionRef = useRef(0);
  const cameraActiveRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const release = useCallback(() => {
    sessionRef.current++;
    cameraActiveRef.current = false;
    abortRef.current?.abort();
    abortRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const reset = useCallback(() => {
    release();
    setMode("idle");
    setTorch(false);
    setTorchAvailable(false);
    setTorchPending(false);
    setError(null);
  }, [release]);

  const getDecoder = () => {
    if (!decoderRef.current)
      decoderRef.current = createBarcodeDecoder().catch((error: unknown) => {
        decoderRef.current = null;
        throw error;
      });
    return decoderRef.current;
  };

  const complete = (result: ScanResult, session: number) => {
    if (session !== sessionRef.current) return;
    reset();
    setOpen(false);
    onDetectedRef.current(result);
  };

  const startCamera = async () => {
    reset();
    const session = sessionRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "La cámara requiere HTTPS y un navegador compatible. Puedes elegir una imagen de tu galería.",
      );
      return;
    }
    cameraActiveRef.current = true;
    setMode("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Video unavailable");
      video.srcObject = stream;
      await video.play();
      if (session !== sessionRef.current) return;
      const track = stream.getVideoTracks()[0];
      try {
        const capabilities = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        setTorchAvailable(capabilities?.torch === true);
      } catch {
        setTorchAvailable(false);
      }
      track?.addEventListener(
        "ended",
        () => {
          if (session !== sessionRef.current) return;
          reset();
          setError(
            "La cámara se desconectó. Vuelve a activarla o elige una imagen.",
          );
        },
        { once: true },
      );
      const decoder = await getDecoder();
      if (session !== sessionRef.current) return;
      setMode("camera");
      const canvas = document.createElement("canvas");
      const detect = async () => {
        if (session !== sessionRef.current) return;
        try {
          if (video.readyState >= 2 && video.videoWidth > 0) {
            const results = await decoder.detect(
              scannerCanvas(
                video,
                video.videoWidth,
                video.videoHeight,
                1280,
                canvas,
              ),
            );
            if (session !== sessionRef.current) return;
            if (results[0]) {
              complete(results[0], session);
              return;
            }
          }
        } catch {
          if (session !== sessionRef.current) return;
          reset();
          setError(
            "No se pudo preparar el lector. Reintenta la cámara o elige una imagen.",
          );
          return;
        }
        if (session === sessionRef.current)
          timerRef.current = setTimeout(() => void detect(), 250);
      };
      void detect();
    } catch (error) {
      if (session !== sessionRef.current) return;
      reset();
      setError(cameraError(error));
    }
  };

  const readImage = async (file: File) => {
    reset();
    const session = sessionRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setMode("image");
    try {
      const canvas = await scannerImage(file, controller.signal);
      if (session !== sessionRef.current) return;
      const decoder = await getDecoder();
      if (session !== sessionRef.current) return;
      const results = await decoder.detect(canvas);
      if (session !== sessionRef.current) return;
      if (results[0]) {
        complete(results[0], session);
        return;
      }
      reset();
      setError(
        "No se encontró un código legible en la imagen. Prueba con una foto más nítida y el código completo.",
      );
    } catch (error) {
      if (session !== sessionRef.current) return;
      reset();
      setError(
        error instanceof Error ? error.message : "No se pudo leer la imagen.",
      );
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || torchPending) return;
    const session = sessionRef.current;
    setTorchPending(true);
    try {
      await track.applyConstraints({
        advanced: [
          { torch: !torch } as MediaTrackConstraintSet & { torch: boolean },
        ],
      });
      if (session === sessionRef.current) {
        setTorch(!torch);
        setError(null);
      }
    } catch {
      if (session === sessionRef.current)
        setError(
          "No se pudo cambiar el flash. Puedes seguir escaneando con más luz.",
        );
    } finally {
      if (session === sessionRef.current) setTorchPending(false);
    }
  };

  useEffect(() => {
    setReady(true);
    const pause = () => {
      if (document.hidden && cameraActiveRef.current) {
        reset();
        setError(
          "La cámara se pausó al salir de esta pestaña. Actívala para continuar.",
        );
      }
    };
    document.addEventListener("visibilitychange", pause);
    return () => {
      document.removeEventListener("visibilitychange", pause);
      release();
    };
  }, [release, reset]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        reset();
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          disabled={!ready}
          aria-label="Escanear código de barras"
          title="Escanear código de barras"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Camera className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl gap-0 overflow-y-auto border-slate-800 bg-slate-950 p-0 text-white">
        <DialogHeader className="p-5 pb-4 text-left sm:p-6">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
            <ScanLine className="size-4" /> Lector de productos
          </p>
          <DialogTitle className="pr-6 text-xl">
            Escanear código de barras
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Usa la cámara o elige una foto. La lectura se realiza en este
            dispositivo.
          </DialogDescription>
        </DialogHeader>
        <div className="relative mx-5 flex aspect-[4/3] min-h-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 sm:mx-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            aria-label="Vista previa de la cámara"
            className={`absolute inset-0 h-full w-full object-contain ${mode === "camera" || mode === "starting" ? "" : "hidden"}`}
          />
          {mode === "camera" ? (
            <div className="pointer-events-none absolute inset-[12%] rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]">
              <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.45)]" />
            </div>
          ) : (
            <div role="status" className="relative px-6 text-center">
              {mode === "starting" || mode === "image" ? (
                <Loader2 className="mx-auto mb-4 size-9 animate-spin text-emerald-400 motion-reduce:animate-none" />
              ) : (
                <ScanLine className="mx-auto mb-4 size-12 text-slate-600" />
              )}
              <p className="text-sm font-medium text-slate-200">
                {mode === "starting"
                  ? "Preparando cámara…"
                  : mode === "image"
                    ? "Leyendo imagen…"
                    : "Un código, dos formas de leerlo"}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {mode === "idle"
                  ? "EAN, UPC, GS1, QR y DataMatrix. Mantén visible el código completo."
                  : "Puedes cerrar el lector en cualquier momento."}
              </p>
            </div>
          )}
        </div>
        <div className="space-y-4 p-5 sm:p-6">
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-200"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={mode === "starting" || mode === "image"}
              onClick={() => (mode === "camera" ? reset() : void startCamera())}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:opacity-50"
            >
              <Camera className="size-4" />
              {mode === "camera" ? "Detener cámara" : "Activar cámara"}
            </button>
            <button
              type="button"
              disabled={mode === "image"}
              onClick={() => fileRef.current?.click()}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
            >
              <ImagePlus className="size-4" />
              Elegir imagen
            </button>
            {mode === "camera" && torchAvailable && (
              <button
                type="button"
                aria-label={torch ? "Apagar flash" : "Encender flash"}
                aria-pressed={torch}
                disabled={torchPending}
                onClick={() => void toggleTorch()}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm disabled:opacity-50"
              >
                {torch ? (
                  <Zap className="size-4 text-amber-300" />
                ) : (
                  <ZapOff className="size-4" />
                )}
                Flash
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={SCANNER_IMAGE_TYPES.join(",")}
            aria-label="Imagen con código de barras"
            className="hidden"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void readImage(file);
            }}
          />
          <p className="text-center text-xs leading-relaxed text-slate-500">
            Fotos de hasta 10 MB · El flash aparece si tu cámara lo admite.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
