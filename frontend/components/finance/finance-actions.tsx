"use client";

import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/common/delete-dialog";
import type { FinanceRecord } from "@/types/api";
import { FinanceFormDialog } from "./finance-form";

interface FinanceEmployeeOption {
  id: string;
  name: string;
}

export function NewFinanceButton({
  employees,
}: {
  employees: FinanceEmployeeOption[];
}) {
  return (
    <FinanceFormDialog
      employees={employees}
      trigger={
        <Button className="rounded-2xl bg-white px-6 py-3 text-sm font-medium text-emerald-600 hover:bg-white/90">
          <Plus className="mr-2 size-4" />
          Nuevo registro
        </Button>
      }
    />
  );
}

export function FinanceRowActions({
  record,
  employees,
}: {
  record: FinanceRecord;
  employees: FinanceEmployeeOption[];
}) {
  if (!record.editable) {
    return <span className="text-xs text-foreground/30">Automático</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <FinanceFormDialog
        record={record}
        employees={employees}
        trigger={
          <button
            type="button"
            title="Editar registro"
            className="rounded-lg p-2 hover:bg-foreground/5"
          >
            <Pencil className="size-4 text-foreground/50" />
          </button>
        }
      />
      <DeleteDialog
        id={record.id}
        entity="finance"
        title="Eliminar registro"
        description={`Se eliminará "${record.description}" del historial financiero. Esta acción no se puede deshacer.`}
        successMessage="Registro eliminado correctamente"
      />
    </div>
  );
}
