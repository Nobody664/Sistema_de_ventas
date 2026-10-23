import Link from "next/link";
import { Card } from "@/components/ui/card";
import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import type { CreditNotesResponse } from "@/types/credit-notes";
import { ReceiptText } from "lucide-react";

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

export default async function CreditNotesPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  let notes: CreditNotesResponse | null = null;
  try {
    notes = await serverApiFetch<CreditNotesResponse>(
      "/credit-notes",
      accessToken,
    );
  } catch {
    notes = null;
  }

  const noteList = notes?.data ?? [];

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-orange-500 to-rose-600 p-6 text-white sm:p-8 animate-fade-in-up">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/20 p-3">
            <ReceiptText className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">
              Notas de crédito
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {notes?.total ?? 0} notas registradas
            </p>
          </div>
        </div>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        {noteList.length > 0 ? (
          <div className="divide-y divide-foreground/10">
            {noteList.map((note) => (
              <Link
                key={note.id}
                href={`/sales/${note.saleId}`}
                className="flex items-center justify-between gap-4 py-4 transition hover:bg-foreground/5 sm:px-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {note.noteNumber}
                    <span className="ml-2 rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-600">
                      {REASON_LABEL[note.reason] ?? note.reason}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-foreground/50">
                    Venta #{note.sale?.saleNumber ?? "-"} ·{" "}
                    {new Date(note.createdAt).toLocaleDateString("es-PE")}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-medium">
                    S/ {Number(note.totalAmount).toFixed(2)}
                  </span>
                  <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs">
                    {STATUS_LABEL[note.status] ?? note.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center text-foreground/50">
            Aún no hay notas de crédito.
          </div>
        )}
      </Card>
    </div>
  );
}
