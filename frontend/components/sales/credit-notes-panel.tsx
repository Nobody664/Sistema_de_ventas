"use client";

import { useCallback, useEffect, useState } from "react";
import { ReceiptText, Plus, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { usePermissions } from "@/hooks/usePermissions";
import type { CreditNote, CreditNotesResponse } from "@/types/credit-notes";

interface CreditNotesPanelProps {
  saleId: string;
}

const REASON_LABEL: Record<string, string> = {
  RETURN: "Devolución",
  DISCOUNT: "Descuento",
  CORRECTION: "Corrección",
  OTHER: "Otro",
};

const STATUS_LABEL: Record<string, string> = {
  ISSUED: "Emitida",
  APPLIED: "Aplicada",
  CANCELLED: "Anulada",
};

export function CreditNotesPanel({ saleId }: CreditNotesPanelProps) {
  const addToast = useUiStore((state) => state.addToast);
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("credit_note:create");

  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch<CreditNotesResponse>(
        `/credit-notes?saleId=${saleId}`,
      );
      setNotes(response.data);
    } catch {
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, [saleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async () => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      addToast("Ingresa un monto válido", "error");
      return;
    }

    setSaving(true);
    try {
      await apiFetch<CreditNote>("/credit-notes", {
        method: "POST",
        body: JSON.stringify({
          saleId,
          type: "CREDIT",
          reason: "DISCOUNT",
          description: description.trim() || "Nota de crédito por descuento",
          items: [
            {
              description: description.trim() || "Descuento",
              quantity: 1,
              unitPrice: parsed,
            },
          ],
        }),
      });
      addToast("Nota de crédito emitida", "success");
      setAmount("");
      setDescription("");
      setShowForm(false);
      await load();
    } catch (error) {
      addToast(
        error instanceof Error
          ? error.message
          : "No se pudo emitir la nota de crédito",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <ReceiptText className="h-5 w-5 text-slate-400" />
          Notas de crédito
        </h2>
        {canCreate && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm((value) => !value)}
          >
            <Plus className="mr-1 h-4 w-4" />
            Nueva
          </Button>
        )}
      </div>

      {showForm && canCreate && (
        <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-3">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Monto (S/)"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <Input
            className="sm:col-span-2"
            placeholder="Motivo (opcional)"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="sm:col-span-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowForm(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600"
              onClick={handleCreate}
              disabled={saving}
            >
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Emitir
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando notas...</p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-slate-500">
          No hay notas de crédito para esta venta.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left text-sm font-medium text-slate-500">
                  Número
                </th>
                <th className="pb-3 text-left text-sm font-medium text-slate-500">
                  Motivo
                </th>
                <th className="pb-3 text-left text-sm font-medium text-slate-500">
                  Estado
                </th>
                <th className="pb-3 text-right text-sm font-medium text-slate-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id} className="border-b border-slate-100">
                  <td className="py-3 font-medium">{note.noteNumber}</td>
                  <td className="py-3">
                    {REASON_LABEL[note.reason] ?? note.reason}
                  </td>
                  <td className="py-3">
                    {STATUS_LABEL[note.status] ?? note.status}
                  </td>
                  <td className="py-3 text-right">
                    S/ {Number(note.totalAmount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
