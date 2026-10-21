"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";

interface ExportButtonsProps {
  endpoint: string;
}

type Format = "csv" | "excel" | "pdf";

export function ExportButtons({ endpoint }: ExportButtonsProps) {
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState<Format | null>(null);

  const handleExport = async (format: Format) => {
    setLoading(format);
    try {
      const separator = endpoint.includes("?") ? "&" : "?";
      const response = await apiFetch<{
        data: string;
        contentType: string;
        filename: string;
      }>(`${endpoint}${separator}format=${format}`);

      if (response?.data) {
        const link = document.createElement("a");
        link.href = `data:${response.contentType};base64,${response.data}`;
        link.download = response.filename;
        link.click();
      }
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "No se pudo exportar",
        "error",
      );
    } finally {
      setLoading(null);
    }
  };

  const options: { format: Format; label: string }[] = [
    { format: "csv", label: "CSV" },
    { format: "excel", label: "Excel" },
    { format: "pdf", label: "PDF" },
  ];

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-foreground/10 bg-white px-4 py-2 text-sm transition hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Exportar
      </summary>
      <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-xl border border-foreground/10 bg-white py-1 shadow-lg">
        {options.map((option) => (
          <button
            key={option.format}
            type="button"
            onClick={() => handleExport(option.format)}
            disabled={loading !== null}
            className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5 disabled:opacity-50"
          >
            {option.label}
          </button>
        ))}
      </div>
    </details>
  );
}
