"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ClipboardList,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  emptyStockEntryLine,
  receptionReferenceCost,
  stockEntryLineError,
  type StockEntryLine,
} from "@/lib/stock-entry-reception";
import { expiryProfileOption } from "@/lib/product-expiry";
import type { StockEntryProductOption } from "@/app/(dashboard)/inventory/entries/page";
import { StockEntryScanner } from "./stock-entry-scanner";

const units: Record<string, string> = {
  UNIT: "und",
  KG: "kg",
  LT: "lt",
  MT: "mt",
};
const controlClass =
  "h-11 w-full rounded-xl border border-foreground/15 bg-background px-3 text-sm text-foreground focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:opacity-50";
const productLabel = (product: StockEntryProductOption) =>
  [
    product.name,
    product.description?.trim() ? `— ${product.description.trim()}` : "",
    product.sku ? `(${product.sku})` : "",
  ]
    .filter(Boolean)
    .join(" ");

export function StockEntryProducts({
  products,
  lines,
  onChange,
  onPendingChange,
  disabled,
}: {
  products: StockEntryProductOption[];
  lines: StockEntryLine[];
  onChange: Dispatch<SetStateAction<StockEntryLine[]>>;
  onPendingChange: (pending: boolean) => void;
  disabled: boolean;
}) {
  const prefix = useId();
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState(emptyStockEntryLine);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [scannerVersion, setScannerVersion] = useState(0);
  const lineNumber = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLSelectElement>(null);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const product = productMap.get(draft.productId);
  const factor = Number(
    product?.presentations.find((item) => item.id === draft.presentationId)
      ?.factor ?? 1,
  );
  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return products.filter((item) =>
      [item.name, item.description, item.sku].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [products, filter]);
  const options =
    product && !filtered.some((item) => item.id === product.id)
      ? [product, ...filtered]
      : filtered;
  useEffect(
    () => onPendingChange(!!draft.productId),
    [draft.productId, onPendingChange],
  );

  const selectProduct = (id: string) => {
    setDraft({
      ...emptyStockEntryLine(),
      productId: id,
      unitCost: receptionReferenceCost(productMap.get(id)),
    });
    setError("");
    setMessage("");
  };
  const updateDraft = (field: keyof StockEntryLine, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "presentationId"
        ? {
            unitCost: receptionReferenceCost(
              productMap.get(current.productId),
              value,
            ),
          }
        : {}),
    }));
    setError("");
  };
  const resetDraft = () => {
    setDraft(emptyStockEntryLine());
    setScannerVersion((current) => current + 1);
    setError("");
  };
  const addProduct = () => {
    if (disabledRef.current) return;
    const validation = stockEntryLineError(draft, product);
    if (validation) {
      setError(validation);
      return;
    }
    const key = `reception-${++lineNumber.current}`;
    onChange((current) => [
      ...current,
      { ...draft, batchNumber: draft.batchNumber.trim(), key },
    ]);
    setMessage(`${product!.name} agregado a la recepción.`);
    resetDraft();
    searchRef.current?.focus();
    searchRef.current?.select();
  };
  const updateRow = (key: string, field: keyof StockEntryLine, value: string) =>
    onChange((current) =>
      current.map((line) =>
        line.key === key
          ? {
              ...line,
              [field]: value,
              ...(field === "presentationId"
                ? {
                    unitCost: receptionReferenceCost(
                      productMap.get(line.productId),
                      value,
                    ),
                  }
                : {}),
            }
          : line,
      ),
    );

  return (
    <div className="space-y-6">
      <section
        aria-labelledby={`${prefix}-search-title`}
        className="rounded-2xl border border-foreground/10 bg-muted/25 p-4 sm:p-5"
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.defaultPrevented &&
            event.target instanceof HTMLInputElement
          ) {
            event.preventDefault();
            if (event.target === searchRef.current) productRef.current?.focus();
            else addProduct();
          }
        }}
      >
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-xl bg-emerald-600/10 p-2 text-emerald-700 dark:text-emerald-300">
            <Search className="size-5" />
          </div>
          <div>
            <h2 id={`${prefix}-search-title`} className="font-display text-lg">
              Buscar producto a recibir
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Busca o escanea, completa los datos y agrégalo a la tabla. El
              stock se actualiza al registrar la entrada.
            </p>
          </div>
        </div>
        <fieldset disabled={disabled} className="min-w-0 space-y-4">
          <StockEntryScanner
            key={scannerVersion}
            onResolved={(found, parsed) => {
              if (disabledRef.current) return;
              const selected = productMap.get(found.id);
              if (!selected) {
                setError(
                  "Este producto no está disponible en la lista de entradas.",
                );
                return;
              }
              setDraft((current) => {
                const same = current.productId === found.id;
                const presentationId =
                  found.matchedPresentation?.id ??
                  (same ? current.presentationId : "");
                return {
                  ...(same ? current : emptyStockEntryLine()),
                  productId: found.id,
                  presentationId,
                  unitCost:
                    same &&
                    presentationId === current.presentationId &&
                    current.unitCost
                      ? current.unitCost
                      : receptionReferenceCost(selected, presentationId),
                  batchNumber:
                    (same ? current.batchNumber : "") || parsed.lot || "",
                  expiryDate:
                    (same ? current.expiryDate : "") || parsed.expiry || "",
                };
              });
              setError("");
              setMessage(
                "Código reconocido. Revisa los datos y pulsa Agregar producto.",
              );
            }}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-filter`}>
                Buscar por nombre, descripción o SKU
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
                <Input
                  ref={searchRef}
                  id={`${prefix}-filter`}
                  aria-label="Buscar producto a recibir"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  placeholder="Filtrar por nombre, descripción o SKU…"
                  className="h-11 pl-10"
                />
              </div>
              <p className="text-xs text-foreground/50">
                {filtered.length} productos encontrados
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-product`}>Producto a recibir</Label>
              <select
                ref={productRef}
                id={`${prefix}-product`}
                value={draft.productId}
                onChange={(event) => selectProduct(event.target.value)}
                className={controlClass}
              >
                <option value="">Selecciona un producto</option>
                {options.map((item) => (
                  <option key={item.id} value={item.id}>
                    {productLabel(item)}
                  </option>
                ))}
              </select>
              {!filtered.length && (
                <p className="text-xs text-foreground/60">
                  No hay coincidencias. Prueba otro nombre, descripción o SKU.
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <div className="col-span-2 space-y-2">
              <Label htmlFor={`${prefix}-presentation`}>Presentación</Label>
              <select
                id={`${prefix}-presentation`}
                value={draft.presentationId}
                disabled={!product || disabled}
                onChange={(event) =>
                  updateDraft("presentationId", event.target.value)
                }
                className={controlClass}
              >
                <option value="">
                  Unidad base
                  {product
                    ? ` (${units[product.baseUnit] ?? product.baseUnit})`
                    : ""}
                </option>
                {product?.presentations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ×{Number(item.factor)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-quantity`}>Cantidad</Label>
              <Input
                id={`${prefix}-quantity`}
                type="number"
                step="0.001"
                min="0.001"
                value={draft.quantity}
                onChange={(event) =>
                  updateDraft("quantity", event.target.value)
                }
                placeholder="0"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-cost`}>Costo unitario (S/)</Label>
              <Input
                id={`${prefix}-cost`}
                type="number"
                step="0.0001"
                min="0"
                value={draft.unitCost}
                onChange={(event) =>
                  updateDraft("unitCost", event.target.value)
                }
                placeholder="0.00"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-batch`}>Lote</Label>
              <Input
                id={`${prefix}-batch`}
                aria-label="Lote de la entrada"
                value={draft.batchNumber}
                maxLength={80}
                onChange={(event) =>
                  updateDraft("batchNumber", event.target.value)
                }
                placeholder="Opcional"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${prefix}-expiry`}>Vencimiento</Label>
              <Input
                id={`${prefix}-expiry`}
                type="date"
                value={draft.expiryDate}
                onChange={(event) =>
                  updateDraft("expiryDate", event.target.value)
                }
                className="h-11"
              />
            </div>
          </div>
          {product && (
            <p className="text-xs text-foreground/60">
              {expiryProfileOption(product.expiryProfile ?? "STANDARD").label} ·
              Cantidad base:{" "}
              {((Number(draft.quantity) || 0) * factor).toFixed(3)}{" "}
              {units[product.baseUnit] ?? product.baseUnit}
              {product.costPrice !== null &&
                ` · Costo referencial base: S/ ${Number(product.costPrice).toFixed(4)}`}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              role="status"
              className="text-sm text-emerald-700 dark:text-emerald-300"
            >
              {message}
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetDraft();
                  setMessage("");
                }}
                disabled={disabled || !draft.productId}
              >
                <X className="mr-1.5 size-4" />
                Limpiar selección
              </Button>
              <Button
                type="button"
                disabled={disabled || !product}
                onClick={addProduct}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Plus className="mr-1.5 size-4" />
                Agregar producto
              </Button>
            </div>
          </div>
        </fieldset>
      </section>
      <section aria-labelledby={`${prefix}-table-title`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="size-4 text-foreground/50" />
            <h2 id={`${prefix}-table-title`} className="font-display text-lg">
              Productos a recibir
            </h2>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/60">
              {lines.length}
            </span>
          </div>
          <p className="text-xs text-foreground/50">
            Edita los datos de recepción antes de registrar.
          </p>
        </div>
        {!lines.length ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-foreground/15 p-8 text-center">
            <PackagePlus className="mb-1 size-8 text-foreground/30" />
            <p className="text-sm font-medium">
              Todavía no agregaste productos
            </p>
            <p className="text-xs text-foreground/55">
              Usa el buscador superior y pulsa Agregar producto.
            </p>
          </div>
        ) : (
          <div
            className="overflow-x-auto rounded-2xl border border-foreground/10"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                event.target instanceof HTMLInputElement
              ) {
                event.preventDefault();
                event.target.blur();
              }
            }}
          >
            <table className="w-full min-w-[1080px] text-sm">
              <caption className="sr-only">
                Productos seleccionados para registrar una entrada de stock
              </caption>
              <thead className="bg-muted/50 text-left text-xs text-foreground/60">
                <tr>
                  {[
                    "Producto",
                    "Presentación",
                    "Cantidad",
                    "Costo unit. (S/)",
                    "Lote",
                    "Vencimiento",
                    "Importe",
                    "Acciones",
                  ].map((title) => (
                    <th
                      key={title}
                      scope="col"
                      className="px-3 py-3 font-semibold"
                    >
                      {title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {lines.map((line, index) => {
                  const rowProduct = productMap.get(line.productId);
                  const rowFactor = Number(
                    rowProduct?.presentations.find(
                      (item) => item.id === line.presentationId,
                    )?.factor ?? 1,
                  );
                  const rowError = stockEntryLineError(line, rowProduct);
                  const rowLabel = `${rowProduct?.name ?? "Producto"}, fila ${index + 1}`;
                  const quantity = Number(line.quantity);
                  const cost = Number(line.unitCost);
                  return (
                    <tr key={line.key} className="align-top hover:bg-muted/20">
                      <td className="min-w-48 max-w-72 px-3 py-4">
                        <span className="font-medium">
                          {rowProduct?.name ?? "Producto no disponible"}
                        </span>
                        <p className="mt-1 text-xs text-foreground/50">
                          {rowProduct?.sku ?? "Sin SKU"} · Base:{" "}
                          {Number.isFinite(quantity)
                            ? (quantity * rowFactor).toFixed(3)
                            : "—"}{" "}
                          {rowProduct
                            ? (units[rowProduct.baseUnit] ??
                              rowProduct.baseUnit)
                            : ""}
                        </p>
                        {rowError && (
                          <p
                            className="mt-2 text-xs text-red-700 dark:text-red-300"
                            role="alert"
                          >
                            {rowError}
                          </p>
                        )}
                      </td>
                      <td className="min-w-40 px-3 py-3">
                        <select
                          aria-label={`Presentación de ${rowLabel}`}
                          value={line.presentationId}
                          disabled={disabled}
                          onChange={(event) =>
                            updateRow(
                              line.key,
                              "presentationId",
                              event.target.value,
                            )
                          }
                          className={controlClass}
                        >
                          <option value="">Unidad base</option>
                          {rowProduct?.presentations.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name} ×{Number(item.factor)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="min-w-28 px-3 py-3">
                        <Input
                          aria-label={`Cantidad recibida de ${rowLabel}`}
                          disabled={disabled}
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={line.quantity}
                          onChange={(event) =>
                            updateRow(line.key, "quantity", event.target.value)
                          }
                          className="h-11"
                        />
                      </td>
                      <td className="min-w-32 px-3 py-3">
                        <Input
                          aria-label={`Costo recibido de ${rowLabel}`}
                          disabled={disabled}
                          type="number"
                          step="0.0001"
                          min="0"
                          value={line.unitCost}
                          onChange={(event) =>
                            updateRow(line.key, "unitCost", event.target.value)
                          }
                          className="h-11"
                        />
                      </td>
                      <td className="min-w-32 px-3 py-3">
                        <Input
                          aria-label={`Lote de ${rowLabel}`}
                          disabled={disabled}
                          value={line.batchNumber}
                          maxLength={80}
                          onChange={(event) =>
                            updateRow(
                              line.key,
                              "batchNumber",
                              event.target.value,
                            )
                          }
                          className="h-11"
                        />
                      </td>
                      <td className="min-w-40 px-3 py-3">
                        <Input
                          aria-label={`Vencimiento de ${rowLabel}`}
                          disabled={disabled}
                          type="date"
                          value={line.expiryDate}
                          onChange={(event) =>
                            updateRow(
                              line.key,
                              "expiryDate",
                              event.target.value,
                            )
                          }
                          className="h-11"
                        />
                      </td>
                      <td className="whitespace-nowrap px-3 py-6 font-semibold tabular-nums">
                        S/{" "}
                        {Number.isFinite(quantity * cost) &&
                        quantity > 0 &&
                        cost >= 0
                          ? (quantity * cost).toFixed(2)
                          : "0.00"}
                      </td>
                      <td className="px-3 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={disabled}
                          aria-label={`Retirar ${rowLabel}`}
                          onClick={() =>
                            onChange((current) =>
                              current.filter((item) => item.key !== line.key),
                            )
                          }
                          className="h-11 w-11 text-foreground/50 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
