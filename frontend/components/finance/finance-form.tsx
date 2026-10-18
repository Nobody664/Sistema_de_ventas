'use client';

import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiFetch, getAccessToken } from '@/lib/api';
import { handleLimitError } from '@/lib/handle-limit-error';
import { createFinanceRecordSchema } from '@/lib/validations/finance.validation';
import { useUiStore } from '@/store/ui-store';
import type { FinanceRecord } from '@/types/api';

export interface FinanceEmployeeOption {
  id: string;
  name: string;
}

interface FinanceFormDialogProps {
  employees: FinanceEmployeeOption[];
  record?: FinanceRecord;
  trigger: React.ReactNode;
}

const INPUT_CLASS =
  'h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all';

const ENTRY_CATEGORIES = [
  { value: 'PURCHASE', label: 'Compra a proveedor' },
  { value: 'OTHER', label: 'Otra entrada' },
];

const EXIT_CATEGORIES = [
  { value: 'PAYROLL', label: 'Pago de sueldo' },
  { value: 'ELECTRICITY', label: 'Luz' },
  { value: 'WATER', label: 'Agua' },
  { value: 'MAINTENANCE', label: 'Mantenimiento' },
  { value: 'OTHER', label: 'Otro gasto' },
];

export function FinanceFormDialog({ employees, record, trigger }: FinanceFormDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const addToast = useUiStore((state) => state.addToast);

  const isEdit = !!record;
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'ENTRY' | 'EXIT'>(record?.direction ?? 'EXIT');
  const [category, setCategory] = useState<string>(record?.category ?? 'OTHER');
  const [employeeId, setEmployeeId] = useState(record?.employeeId ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const categories = direction === 'ENTRY' ? ENTRY_CATEGORIES : EXIT_CATEGORIES;

  const resetState = () => {
    setDirection(record?.direction ?? 'EXIT');
    setCategory(record?.category ?? 'OTHER');
    setEmployeeId(record?.employeeId ?? '');
    setError(null);
    setFieldErrors({});
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      resetState();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const result = createFinanceRecordSchema.safeParse({
      direction,
      category: direction === 'ENTRY' && category === 'PURCHASE' ? 'PURCHASE' : category,
      description: ((formData.get('description') as string) ?? '').trim(),
      amount: ((formData.get('amount') as string) ?? '').trim(),
      recordDate: (formData.get('recordDate') as string) ?? '',
      dueDate: (formData.get('dueDate') as string) ?? '',
      reference: ((formData.get('reference') as string) ?? '').trim(),
      supplier: ((formData.get('supplier') as string) ?? '').trim(),
      employeeId: category === 'PAYROLL' ? employeeId : '',
      notes: ((formData.get('notes') as string) ?? '').trim(),
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field) {
          errors[field as string] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    const payload = {
      direction: result.data.direction,
      category: result.data.category || undefined,
      description: result.data.description,
      amount: result.data.amount,
      recordDate: `${result.data.recordDate}T00:00:00`,
      dueDate: result.data.dueDate ? `${result.data.dueDate}T00:00:00` : null,
      reference: result.data.reference || null,
      supplier: result.data.supplier || null,
      employeeId: result.data.employeeId || null,
      notes: result.data.notes || null,
    };

    setLoading(true);
    try {
      await apiFetch(isEdit ? `/finance/${record.id}` : '/finance', {
        method: isEdit ? 'PATCH' : 'POST',
        token: getAccessToken(),
        body: JSON.stringify(payload),
      });

      queryClient.invalidateQueries({ queryKey: ['finance'] });
      addToast(isEdit ? 'Registro actualizado' : 'Registro financiero creado', 'success');
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const { message, isLimitError } = handleLimitError(err);
      setError(message);
      addToast(message, isLimitError ? 'info' : 'error');
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar registro' : 'Nuevo registro'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Actualiza los datos del registro financiero.'
              : 'Registra una entrada o salida manual. Las ventas se contabilizan automáticamente.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(['ENTRY', 'EXIT'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setDirection(value);
                  setCategory(value === 'ENTRY' ? 'PURCHASE' : 'OTHER');
                }}
                className={`h-11 rounded-xl border text-sm font-medium transition ${
                  direction === value
                    ? value === 'ENTRY'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-red-500 bg-red-50 text-red-600'
                    : 'border-slate-200 bg-slate-50/50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                {value === 'ENTRY' ? 'Entrada (compra)' : 'Salida (gasto)'}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Categoría</Label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm focus:border-emerald-500 focus:outline-none"
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {fieldErrors.category && <p className="text-xs text-red-500">{fieldErrors.category}</p>}
          </div>

          {direction === 'EXIT' && category === 'PAYROLL' && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Empleado</Label>
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 text-sm focus:border-emerald-500 focus:outline-none"
              >
                <option value="">Selecciona un empleado</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              {fieldErrors.employeeId && (
                <p className="text-xs text-red-500">{fieldErrors.employeeId}</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Descripción</Label>
            <Input
              name="description"
              defaultValue={record?.description ?? ''}
              placeholder={direction === 'ENTRY' ? 'Compra de mercadería' : 'Recibo de luz de mayo'}
              className={INPUT_CLASS}
            />
            {fieldErrors.description && <p className="text-xs text-red-500">{fieldErrors.description}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Monto</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">S/</span>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={record ? Number(record.amount).toFixed(2) : ''}
                  placeholder="0.00"
                  className={`${INPUT_CLASS} pl-9`}
                />
              </div>
              {fieldErrors.amount && <p className="text-xs text-red-500">{fieldErrors.amount}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Referencia</Label>
              <Input
                name="reference"
                defaultValue={record?.reference ?? ''}
                placeholder="Boleta, factura..."
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Fecha</Label>
              <Input
                name="recordDate"
                type="date"
                defaultValue={record ? record.recordDate.slice(0, 10) : today}
                className={INPUT_CLASS}
              />
              {fieldErrors.recordDate && <p className="text-xs text-red-500">{fieldErrors.recordDate}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Vencimiento</Label>
              <Input
                name="dueDate"
                type="date"
                defaultValue={record?.dueDate ? record.dueDate.slice(0, 10) : ''}
                className={INPUT_CLASS}
              />
              {fieldErrors.dueDate && <p className="text-xs text-red-500">{fieldErrors.dueDate}</p>}
            </div>

            <div className="col-span-2 space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Proveedor</Label>
              <Input
                name="supplier"
                defaultValue={record?.supplier ?? ''}
                placeholder="Distribuidora..."
                className={INPUT_CLASS}
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Notas</Label>
              <Input
                name="notes"
                defaultValue={record?.notes ?? ''}
                placeholder="Observaciones"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
