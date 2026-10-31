"use client";

import { useEffect, useRef, useState } from "react";
import {
  BarcodeScanner,
  type ScanResult,
} from "@/components/ui/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, getAccessToken } from "@/lib/api";
import { parseBarcode, type ParsedBarcode } from "@/lib/barcode";

export interface ScannedStockProduct {
  id: string;
  matchedPresentation?: { id: string };
}

export function StockEntryScanner({
  onResolved,
}: {
  onResolved: (product: ScannedStockProduct, parsed: ParsedBarcode) => void;
}) {
  const [raw, setRaw] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  useEffect(
    () => () => {
      requestRef.current++;
    },
    [],
  );

  const scan = async (result: ScanResult) => {
    const request = ++requestRef.current;
    setLoading(false);
    const parsed = parseBarcode(result.rawValue, result.format);
    const code =
      parsed.gtinOriginal ?? (parsed.kind === "INTERNAL" ? parsed.raw : "");
    if (
      !code ||
      code.length > 50 ||
      (parsed.kind !== "INTERNAL" && !parsed.gtin)
    ) {
      setMessage(
        parsed.warnings.join(" ") || "El código no contiene un GTIN válido.",
      );
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const product = await apiFetch<ScannedStockProduct | null>(
        `/products/barcode/${encodeURIComponent(code)}`,
        { token: getAccessToken() },
      );
      if (request !== requestRef.current) return;
      if (!product) {
        setMessage("El producto no está en tu catálogo. Créalo primero.");
        return;
      }
      onResolved(product, parsed);
      setMessage(
        parsed.warnings.join(" ") ||
          "Código reconocido. Revisa lote, vencimiento y cantidad.",
      );
    } catch (error) {
      if (request === requestRef.current)
        setMessage(
          error instanceof Error
            ? error.message
            : "No se pudo consultar el código.",
        );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  };

  return (
    <div className="mb-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Código GS1 de la entrada"
          placeholder="Escanea o pega un código GS1"
          value={raw}
          maxLength={2048}
          className="min-w-40 flex-1 bg-white"
          onChange={(event) => setRaw(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void scan({ rawValue: raw, format: "unknown" });
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={loading || !raw.trim()}
          onClick={() => void scan({ rawValue: raw, format: "unknown" })}
        >
          {loading ? "Buscando…" : "Leer código"}
        </Button>
        <BarcodeScanner onDetected={(result) => void scan(result)} />
      </div>
      {message && (
        <p role="status" className="text-xs text-slate-600">
          {message}
        </p>
      )}
    </div>
  );
}
