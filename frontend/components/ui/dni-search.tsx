"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Loader2, Check, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiFetch, getAccessToken } from "@/lib/api";
import { dniIdentityFields, type DniIdentity } from "@/lib/document-identity";

interface DniResult extends DniIdentity {
  dni: string;
  nombre?: string;
  apellidoPaterno?: string;
  apellidoMaterno?: string;
  nombres?: string;
  telefono?: string;
  direccion?: string;
}

interface DniSearchProps {
  onResult?: (data: {
    firstName: string;
    lastName: string;
    phone?: string;
    address?: string;
    documentNumber?: string;
  }) => void;
  documentType?: string;
}

export function DniSearch({ onResult, documentType = "DNI" }: DniSearchProps) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [result, setResult] = useState<DniResult | null>(null);
  const lastSearched = useRef<string>("");
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef<string | null>(null);
  useEffect(() => {
    requestRef.current++;
    abortRef.current?.abort();
    pendingRef.current = null;
    lastSearched.current = "";
    setLoading(false);
    setResult(null);
    setSuccess(false);
    setError(null);
    return () => {
      requestRef.current++;
      abortRef.current?.abort();
      pendingRef.current = null;
    };
  }, [documentType]);

  const isValidLength =
    documentType === "DNI"
      ? documentNumber.length === 8
      : documentNumber.length === 11;

  const searchDocument = useCallback(
    async (value?: string) => {
      const target = value ?? documentNumber;
      const valid =
        documentType === "DNI" ? target.length === 8 : target.length === 11;
      if (!target || !valid) {
        return;
      }
      const pending = `${documentType}:${target}`;
      if (pendingRef.current === pending) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const request = ++requestRef.current;
      pendingRef.current = pending;

      setLoading(true);
      setError(null);
      setSuccess(false);
      setResult(null);

      try {
        if (documentType === "DNI") {
          const data = await apiFetch<DniResult>(`/dni/${target}`, {
            token: getAccessToken(),
            signal: controller.signal,
          });

          if (data && request === requestRef.current) {
            const identity = dniIdentityFields(data, target);
            setResult(data);
            setSuccess(true);

            onResult?.({ ...identity, documentNumber: target });
          }
        } else {
          const data = await apiFetch<DniResult>(`/dni/ruc/${target}`, {
            token: getAccessToken(),
            signal: controller.signal,
          });

          if (data && request === requestRef.current) {
            if (!data.nombre?.trim())
              throw new Error("No se recibió una razón social válida");
            setResult(data);
            setSuccess(true);

            onResult?.({
              firstName: data.nombre || "",
              lastName: "",
              phone: data.telefono,
              address: data.direccion,
              documentNumber: target,
            });
          }
        }
      } catch (err) {
        if (request !== requestRef.current || controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "No se encontraron datos",
        );
      } finally {
        if (request === requestRef.current) {
          pendingRef.current = null;
          setLoading(false);
        }
      }
    },
    [documentNumber, documentType, onResult],
  );

  useEffect(() => {
    if (!isValidLength) return;
    if (lastSearched.current === documentNumber) return;

    const timer = setTimeout(() => {
      if (lastSearched.current === documentNumber) return;
      lastSearched.current = documentNumber;
      void searchDocument(documentNumber);
    }, 350);

    return () => clearTimeout(timer);
  }, [documentNumber, isValidLength, searchDocument]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      lastSearched.current = documentNumber;
      void searchDocument();
    }
  };

  const handleChange = (value: string) => {
    requestRef.current++;
    abortRef.current?.abort();
    pendingRef.current = null;
    setLoading(false);
    const numericValue = value.replace(/\D/g, "");
    const maxLength = documentType === "DNI" ? 8 : 11;
    const next = numericValue.slice(0, maxLength);
    setDocumentNumber(next);
    setSuccess(false);
    setResult(null);
    setError(null);
    if (next.length < maxLength) {
      lastSearched.current = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <Input
            aria-label={documentType === "DNI" ? "Buscar DNI" : "Buscar RUC"}
            value={documentNumber}
            onChange={(e) => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              documentType === "DNI"
                ? "Buscar por DNI (8 dígitos)"
                : "Buscar por RUC (11 dígitos)"
            }
            className={`h-12 rounded-xl border-2 bg-slate-50/50 pr-10 transition-all ${
              success
                ? "border-emerald-500 bg-emerald-50/50 focus:border-emerald-500 focus:ring-emerald-500/20"
                : error
                  ? "border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-500/20"
                  : isValidLength
                    ? "border-blue-500 bg-white focus:border-blue-500 focus:ring-blue-500/20"
                    : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
            ) : success ? (
              <Check className="h-5 w-5 text-emerald-500" />
            ) : documentNumber.length > 0 && !isValidLength ? (
              <AlertCircle className="h-5 w-5 text-amber-500" />
            ) : (
              <Search className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            lastSearched.current = documentNumber;
            void searchDocument();
          }}
          disabled={loading || !isValidLength}
          className="h-12 px-4 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="text-sm text-red-500 flex items-center gap-1.5"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </p>
      )}

      {result && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 p-3"
        >
          <p className="text-sm font-medium text-emerald-800">
            {documentType === "DNI"
              ? result.nombreCompleto ||
                `${result.nombres || ""} ${result.apellidoPaterno || ""} ${result.apellidoMaterno || ""}`.trim()
              : result.nombre || ""}
          </p>
          {result.direccion && (
            <p className="text-xs text-emerald-600 mt-1">{result.direccion}</p>
          )}
        </div>
      )}

      {documentType === "DNI" &&
        documentNumber.length > 0 &&
        documentNumber.length < 8 && (
          <p className="text-xs text-amber-600">El DNI debe tener 8 dígitos</p>
        )}
      {documentType === "RUC" &&
        documentNumber.length > 0 &&
        documentNumber.length < 11 && (
          <p className="text-xs text-amber-600">El RUC debe tener 11 dígitos</p>
        )}
    </div>
  );
}
