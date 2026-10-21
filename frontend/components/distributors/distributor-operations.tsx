"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Banknote,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import type {
  Distributor,
  DistributorProductOption,
} from "@/types/distributors";

type Tab = "stock" | "sale" | "settle" | "delivery";

const selectClass =
  "h-12 w-full rounded-xl border border-input bg-background px-4 text-sm transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20";

export function DistributorOperations({
  distributor,
  products,
}: {
  distributor: Distributor;
  products: DistributorProductOption[];
}) {
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [tab, setTab] = useState<Tab>("stock");
  const [loading, setLoading] = useState(false);

  const [stockMode, setStockMode] = useState<"transfer" | "return">("transfer");
  const [stockProduct, setStockProduct] = useState(products[0]?.id ?? "");
  const [stockQty, setStockQty] = useState("");
  const [stockNotes, setStockNotes] = useState("");

  const [saleLines, setSaleLines] = useState<
    Array<{ productId: string; quantity: string; unitPrice: string }>
  >([{ productId: products[0]?.id ?? "", quantity: "1", unitPrice: "" }]);
  const [salePayment, setSalePayment] = useState<"CASH" | "CARD" | "TRANSFER">(
    "CASH",
  );

  const [settleAmount, setSettleAmount] = useState("");
  const [settleNotes, setSettleNotes] = useState("");

  const [deliveryProduct, setDeliveryProduct] = useState(products[0]?.id ?? "");
  const [deliveryQty, setDeliveryQty] = useState("1");
  const [deliveryStatus, setDeliveryStatus] = useState<
    "PENDING" | "DELIVERED" | "CANCELLED"
  >("PENDING");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  const debt = Number(distributor.balance?.debtAmount ?? 0);

  const run = async (fn: () => Promise<void>, successMsg: string) => {
    setLoading(true);
    try {
      await fn();
      addToast(successMsg, "success");
      router.refresh();
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Error desconocido",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const submitStock = () =>
    run(
      async () => {
        const qty = Number(stockQty);
        if (!stockProduct || !qty || qty < 1)
          throw new Error("Selecciona un producto y una cantidad válida.");
        const endpoint = stockMode === "transfer" ? "transfers" : "returns";
        await apiFetch(`/distributors/${distributor.id}/${endpoint}`, {
          method: "POST",
          token: getAccessToken(),
          body: JSON.stringify({
            items: [{ productId: stockProduct, quantity: qty }],
            notes: stockNotes || undefined,
          }),
        });
        setStockQty("");
        setStockNotes("");
      },
      stockMode === "transfer"
        ? "Stock transferido al distribuidor"
        : "Devolución registrada",
    );

  const submitSale = () =>
    run(async () => {
      const items = saleLines
        .filter((line) => line.productId && Number(line.quantity) > 0)
        .map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unitPrice: line.unitPrice ? Number(line.unitPrice) : undefined,
        }));
      if (items.length === 0)
        throw new Error("Agrega al menos un producto a la venta.");
      await apiFetch(`/distributors/${distributor.id}/sales`, {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({ items, paymentMethod: salePayment }),
      });
      setSaleLines([
        { productId: products[0]?.id ?? "", quantity: "1", unitPrice: "" },
      ]);
    }, "Venta de distribuidor registrada");

  const submitSettle = () =>
    run(async () => {
      const amount = Number(settleAmount);
      if (!amount || amount <= 0) throw new Error("Ingresa un monto válido.");
      await apiFetch(`/distributors/${distributor.id}/settlements`, {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({ amount, notes: settleNotes || undefined }),
      });
      setSettleAmount("");
      setSettleNotes("");
    }, "Liquidación registrada");

  const submitDelivery = () =>
    run(async () => {
      const qty = Number(deliveryQty);
      if (!deliveryProduct || !qty || qty < 1)
        throw new Error("Selecciona un producto y una cantidad válida.");
      await apiFetch(`/distributors/${distributor.id}/deliveries`, {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({
          items: [{ productId: deliveryProduct, quantity: qty }],
          status: deliveryStatus,
          notes: deliveryNotes || undefined,
        }),
      });
      setDeliveryQty("1");
      setDeliveryNotes("");
    }, "Despacho registrado");

  const tabs: Array<{ id: Tab; label: string; icon: typeof Receipt }> = [
    { id: "stock", label: "Stock", icon: ArrowUpFromLine },
    { id: "sale", label: "Venta", icon: Receipt },
    { id: "settle", label: "Liquidación", icon: Banknote },
    { id: "delivery", label: "Despacho", icon: Truck },
  ];

  return (
    <div className="rounded-[28px] border border-foreground/10 bg-card p-6">
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-orange-500 text-white"
                  : "bg-foreground/5 text-foreground/60 hover:bg-foreground/10"
              }`}
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "stock" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => setStockMode("transfer")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${
                stockMode === "transfer"
                  ? "bg-orange-500 text-white"
                  : "bg-foreground/5 text-foreground/60"
              }`}
            >
              <ArrowUpFromLine className="size-4" />
              Transferir
            </button>
            <button
              onClick={() => setStockMode("return")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium transition ${
                stockMode === "return"
                  ? "bg-orange-500 text-white"
                  : "bg-foreground/5 text-foreground/60"
              }`}
            >
              <ArrowDownToLine className="size-4" />
              Devolver
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Producto</Label>
              <select
                value={stockProduct}
                onChange={(e) => setStockProduct(e.target.value)}
                className={selectClass}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (stock {product.stockQuantity})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notas</Label>
            <Input
              value={stockNotes}
              onChange={(e) => setStockNotes(e.target.value)}
              placeholder="Opcional"
              className="h-12 rounded-xl"
            />
          </div>
          <Button
            onClick={submitStock}
            disabled={loading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 font-semibold text-white"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            {stockMode === "transfer"
              ? "Transferir stock"
              : "Registrar devolución"}
          </Button>
        </div>
      )}

      {tab === "sale" && (
        <div className="space-y-4">
          {saleLines.map((line, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3">
              <div className="min-w-[180px] flex-1 space-y-2">
                <Label className="text-xs font-semibold text-foreground/50">
                  Producto
                </Label>
                <select
                  value={line.productId}
                  onChange={(e) =>
                    setSaleLines((lines) =>
                      lines.map((l, i) =>
                        i === index ? { ...l, productId: e.target.value } : l,
                      ),
                    )
                  }
                  className={selectClass}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24 space-y-2">
                <Label className="text-xs font-semibold text-foreground/50">
                  Cant.
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={line.quantity}
                  onChange={(e) =>
                    setSaleLines((lines) =>
                      lines.map((l, i) =>
                        i === index ? { ...l, quantity: e.target.value } : l,
                      ),
                    )
                  }
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="w-28 space-y-2">
                <Label className="text-xs font-semibold text-foreground/50">
                  P. unit.
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="auto"
                  value={line.unitPrice}
                  onChange={(e) =>
                    setSaleLines((lines) =>
                      lines.map((l, i) =>
                        i === index ? { ...l, unitPrice: e.target.value } : l,
                      ),
                    )
                  }
                  className="h-12 rounded-xl"
                />
              </div>
              <button
                onClick={() =>
                  setSaleLines((lines) =>
                    lines.length > 1
                      ? lines.filter((_, i) => i !== index)
                      : lines,
                  )
                }
                className="mb-1 rounded-lg p-2 text-foreground/40 hover:bg-foreground/5"
                title="Quitar"
              >
                <Minus className="size-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setSaleLines((lines) => [
                ...lines,
                {
                  productId: products[0]?.id ?? "",
                  quantity: "1",
                  unitPrice: "",
                },
              ])
            }
            className="flex items-center gap-2 text-sm font-medium text-orange-600 hover:text-orange-700"
          >
            <Plus className="size-4" />
            Agregar producto
          </button>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Método de pago</Label>
            <select
              value={salePayment}
              onChange={(e) =>
                setSalePayment(e.target.value as "CASH" | "CARD" | "TRANSFER")
              }
              className={selectClass}
            >
              <option value="CASH">Efectivo</option>
              <option value="CARD">Tarjeta</option>
              <option value="TRANSFER">Transferencia</option>
            </select>
          </div>
          <Button
            onClick={submitSale}
            disabled={loading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 font-semibold text-white"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Registrar venta
          </Button>
        </div>
      )}

      {tab === "settle" && (
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-500/10 p-4 text-sm text-amber-700">
            Deuda pendiente:{" "}
            <span className="font-semibold">S/ {debt.toFixed(2)}</span>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Monto a liquidar</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              placeholder="0.00"
              className="h-12 rounded-xl"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Notas</Label>
            <Input
              value={settleNotes}
              onChange={(e) => setSettleNotes(e.target.value)}
              placeholder="Opcional"
              className="h-12 rounded-xl"
            />
          </div>
          <Button
            onClick={submitSettle}
            disabled={loading || debt <= 0}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 font-semibold text-white"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Registrar liquidación
          </Button>
        </div>
      )}

      {tab === "delivery" && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Producto</Label>
              <select
                value={deliveryProduct}
                onChange={(e) => setDeliveryProduct(e.target.value)}
                className={selectClass}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Cantidad</Label>
              <Input
                type="number"
                min="1"
                value={deliveryQty}
                onChange={(e) => setDeliveryQty(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Estado</Label>
              <select
                value={deliveryStatus}
                onChange={(e) =>
                  setDeliveryStatus(
                    e.target.value as "PENDING" | "DELIVERED" | "CANCELLED",
                  )
                }
                className={selectClass}
              >
                <option value="PENDING">Pendiente</option>
                <option value="DELIVERED">Entregado</option>
                <option value="CANCELLED">Cancelado</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Notas</Label>
              <Input
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Opcional"
                className="h-12 rounded-xl"
              />
            </div>
          </div>
          <Button
            onClick={submitDelivery}
            disabled={loading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 font-semibold text-white"
          >
            {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
            Registrar despacho
          </Button>
        </div>
      )}
    </div>
  );
}
