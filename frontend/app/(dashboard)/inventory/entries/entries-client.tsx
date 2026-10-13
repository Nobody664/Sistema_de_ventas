'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, getAccessToken } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import { ArrowLeft, ClipboardList, Loader2, PackagePlus, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import type { StockEntryProductOption } from './page';

const UNIT_SHORT: Record<string, string> = {
  UNIT: 'und',
  KG: 'kg',
  LT: 'lt',
  MT: 'mt',
};

interface EntryItem {
  id: string;
  productId: string;
  presentationId: string | null;
  quantity: string;
  baseQuantity: string;
  unitCost: string;
  unitCostPresentation: string;
  product: { id: string; name: string; sku: string | null; baseUnit: string };
  presentation?: { id: string; name: string; factor: string } | null;
}

interface EntryRecord {
  id: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  items: EntryItem[];
}

interface Line {
  key: string;
  productId: string;
  presentationId: string;
  quantity: string;
  unitCost: string;
}

interface StockEntriesClientProps {
  initialEntries: Array<Record<string, unknown>>;
  products: StockEntryProductOption[];
  branches: Array<{ id: string; name: string }>;
}

const emptyLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  productId: '',
  presentationId: '',
  quantity: '',
  unitCost: '',
});

export function StockEntriesClient({ initialEntries, products, branches }: StockEntriesClientProps) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);

  const entries = initialEntries as unknown as EntryRecord[];
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [branchId, setBranchId] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presentationFactor = (line: Line) => {
    const product = productMap.get(line.productId);
    const presentation = product?.presentations.find((p) => p.id === line.presentationId);
    return presentation ? Number(presentation.factor) : 1;
  };

  const updateLine = (key: string, field: keyof Line, value: string) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        if (field === 'productId') {
          return { ...line, productId: value, presentationId: '', unitCost: line.unitCost };
        }
        return { ...line, [field]: value };
      }),
    );
  };

  const totalInvestment = lines.reduce((sum, line) => {
    const quantity = Number(line.quantity) || 0;
    const unitCost = Number(line.unitCost) || 0;
    return sum + quantity * unitCost;
  }, 0);

  const historyInvestment = entries.reduce(
    (sum, entry) => sum + entry.items.reduce((s, item) => s + Number(item.unitCost) * Number(item.quantity), 0),
    0,
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const items = lines
      .filter((line) => line.productId && Number(line.quantity) > 0)
      .map((line) => ({
        productId: line.productId,
        presentationId: line.presentationId || undefined,
        quantity: Number(line.quantity),
        unitCost: Number(line.unitCost) || 0,
      }));

    if (items.length === 0) {
      setError('Agrega al menos un producto con cantidad mayor a 0.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/stock-entries', {
        method: 'POST',
        token: getAccessToken(),
        body: JSON.stringify({
          branchId: branchId || undefined,
          reference: reference || undefined,
          notes: notes || undefined,
          items,
        }),
      });

      addToast('Entrada de stock registrada correctamente', 'success');
      setLines([emptyLine()]);
      setReference('');
      setNotes('');
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo registrar la entrada.';
      setError(message);
      addToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/inventory"
          className="flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a inventario
        </Link>
      </div>

      <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-700 p-6 sm:p-8 text-white animate-fade-in-up">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Inventario</p>
            <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl sm:leading-none">Registrar entrada</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Ingresa mercadería al almacén por unidad o presentación. El kardex y el costo se actualizan automáticamente.
            </p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl bg-white/10 px-6 py-4 backdrop-blur-sm">
            <PackagePlus className="size-8 text-emerald-200" />
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-white/50">Entradas registradas</p>
              <p className="font-display text-2xl">{entries.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-100">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Sucursal</Label>
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              >
                <option value="">Sin sucursal</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Referencia</Label>
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Factura, guía, proveedor..."
                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-slate-700">Notas</Label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observaciones"
                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Productos
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className="h-9 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-emerald-300"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar línea
              </Button>
            </div>

            {lines.map((line) => {
              const product = productMap.get(line.productId);
              const factor = presentationFactor(line);
              const baseQuantity = (Number(line.quantity) || 0) * factor;
              const baseUnitShort = product ? UNIT_SHORT[product.baseUnit] ?? product.baseUnit : '';

              return (
                <div key={line.key} className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-12">
                    <div className="col-span-2 space-y-1 lg:col-span-4">
                      <Label className="text-xs font-semibold text-slate-500">Producto</Label>
                      <select
                        value={line.productId}
                        onChange={(event) => updateLine(line.key, 'productId', event.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">Selecciona un producto</option>
                        {products.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2 space-y-1 lg:col-span-3">
                      <Label className="text-xs font-semibold text-slate-500">Presentación</Label>
                      <select
                        value={line.presentationId}
                        onChange={(event) => updateLine(line.key, 'presentationId', event.target.value)}
                        disabled={!product}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-500 focus:outline-none disabled:bg-slate-100"
                      >
                        <option value="">
                          Unidad base{product ? ` (${UNIT_SHORT[product.baseUnit] ?? product.baseUnit})` : ''}
                        </option>
                        {product?.presentations.map((presentation) => (
                          <option key={presentation.id} value={presentation.id}>
                            {presentation.name} ×{Number(presentation.factor)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-1 space-y-1 lg:col-span-2">
                      <Label className="text-xs font-semibold text-slate-500">Cantidad</Label>
                      <Input
                        type="number"
                        step="0.001"
                        min="0"
                        value={line.quantity}
                        onChange={(event) => updateLine(line.key, 'quantity', event.target.value)}
                        placeholder="0"
                        className="h-11 rounded-lg border-slate-200 bg-white"
                      />
                    </div>

                    <div className="col-span-1 space-y-1 lg:col-span-2">
                      <Label className="text-xs font-semibold text-slate-500">Costo unit.</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">S/</span>
                        <Input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={line.unitCost}
                          onChange={(event) => updateLine(line.key, 'unitCost', event.target.value)}
                          placeholder="0.00"
                          className="h-11 rounded-lg border-slate-200 bg-white pl-9"
                        />
                      </div>
                    </div>

                    <div className="col-span-2 flex items-end justify-between gap-2 lg:col-span-1 lg:justify-end">
                      <p className="text-xs text-slate-500 lg:hidden">
                        Base: {baseQuantity.toFixed(3)} {baseUnitShort}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== line.key) : prev))}
                        disabled={lines.length === 1}
                        className="h-11 w-11 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Eliminar línea"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {product && (
                    <p className="mt-2 text-xs text-slate-400">
                      {line.quantity || 0} {line.presentationId ? product.presentations.find((p) => p.id === line.presentationId)?.name : UNIT_SHORT[product.baseUnit] ?? product.baseUnit}
                      {line.presentationId ? ` × ${factor} = ` : ' = '}
                      <span className="font-semibold text-slate-600">{baseQuantity.toFixed(3)} {UNIT_SHORT[product.baseUnit] ?? product.baseUnit}</span>
                      {' · Costo unitario base: S/ '}
                      {baseQuantity > 0 ? ((Number(line.unitCost) || 0) / factor).toFixed(4) : '0.0000'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex flex-col items-stretch justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Inversión total</p>
              <p className="font-display text-2xl text-slate-900">S/ {totalInvestment.toFixed(2)}</p>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 font-semibold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <PackagePlus className="mr-2 h-4 w-4" />
                  Registrar entrada
                </>
              )}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-200">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Historial</p>
            <h2 className="mt-2 font-display text-2xl">Entradas de stock</h2>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Inversión acumulada</p>
            <p className="font-display text-xl text-slate-900">S/ {historyInvestment.toFixed(2)}</p>
          </div>
        </div>

        <div className="max-h-[600px] overflow-auto rounded-xl border border-foreground/10">
          <table className="w-full min-w-[820px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                <th className="pb-4 pl-4 font-medium">Fecha</th>
                <th className="pb-4 font-medium">Referencia</th>
                <th className="pb-4 font-medium">Sucursal</th>
                <th className="pb-4 font-medium">Producto</th>
                <th className="pb-4 font-medium text-right">Cantidad</th>
                <th className="pb-4 font-medium text-right">Costo total</th>
              </tr>
            </thead>
            <tbody>
              {entries.length > 0 ? (
                entries.map((entry) =>
                  entry.items.map((item, itemIndex) => (
                    <tr key={`${entry.id}-${item.id}`} className="border-b border-foreground/5 table-row-hover">
                      {itemIndex === 0 && (
                        <>
                          <td className="py-3 pl-4 text-sm text-foreground/60" rowSpan={entry.items.length}>
                            {new Date(entry.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 text-sm" rowSpan={entry.items.length}>
                            {entry.reference ?? '—'}
                          </td>
                          <td className="py-3 text-sm text-foreground/60" rowSpan={entry.items.length}>
                            {entry.branch?.name ?? '—'}
                          </td>
                        </>
                      )}
                      <td className="py-3 text-sm font-medium">
                        {item.product.name}
                        {item.presentation ? (
                          <span className="ml-1 text-xs text-slate-400">({item.presentation.name})</span>
                        ) : null}
                      </td>
                      <td className="py-3 text-right text-sm">
                        {Number(item.quantity)} {unitLabel(item, productMap)}
                        <span className="block text-xs text-slate-400">
                          {Number(item.baseQuantity).toFixed(3)} {UNIT_SHORT[item.product.baseUnit] ?? item.product.baseUnit}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right text-sm font-medium">
                        S/ {(Number(item.unitCost) * Number(item.quantity)).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-foreground/50">
                    Aún no hay entradas registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function unitLabel(
  item: EntryItem,
  productMap: Map<string, StockEntryProductOption>,
): string {
  if (item.presentation) return item.presentation.name;
  const product = productMap.get(item.productId);
  return product ? UNIT_SHORT[item.product.baseUnit] ?? item.product.baseUnit : '';
}
