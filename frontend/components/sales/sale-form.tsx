"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Search,
  ArrowLeft,
  Banknote,
  CreditCard,
  Building2,
  Check,
  Receipt,
  Package,
  Store,
  Globe,
  Truck,
  TicketPercent,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, getAccessToken } from "@/lib/api";
import { useUiStore } from "@/store/ui-store";
import { useAuthStore } from "@/stores/auth.store";
import { CustomerSearch } from "@/components/ui/customer-search";
import { CustomerBoxSelector } from "@/components/ui/customer-box-selector";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { QuantityInput } from "@/components/sales/quantity-input";
import { useBarcodeScanner } from "@/components/scanner/hooks/useBarcodeScanner";
import { ScannerStatus } from "@/components/scanner/components/scanner-status";
import {
  playScanBeep,
  playErrorBeep,
} from "@/components/scanner/services/sound";
import {
  maxSaleQuantity,
  normalizeSaleQuantity,
  quantityStep,
  roundMoney,
} from "@/lib/sale-quantity";
import type { Product, Customer } from "@/types/api";
import type { ProductPresentation } from "@/types/generated";
import type { Distributor, DistributorStock } from "@/types/distributors";

const UNIT_SHORT: Record<string, string> = {
  UNIT: "und",
  KG: "kg",
  LT: "lt",
  MT: "mt",
};

interface SaleItem {
  productId: string;
  productName: string;
  productDescription?: string | null;
  basePrice: number;
  presentations: ProductPresentation[];
  baseUnit: string;
  presentationId?: string;
  presentationName?: string;
  factor: number;
  unitPrice: number;
  quantity: number;
  total: number;
  stock: number;
}

interface SelectedCustomer {
  id?: string;
  firstName?: string;
  lastName?: string;
  documentType?: string;
  documentValue?: string;
  email?: string;
  phone?: string;
}

type SaleChannelOption = "POS" | "ONLINE" | "DISTRIBUTOR";

interface AppliedCoupon {
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: number;
}

interface SaleFormProps {
  products: Product[];
  customers: Customer[];
  distributors?: Distributor[];
}

export function SaleForm({
  products,
  customers,
  distributors = [],
}: SaleFormProps) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);

  const [loading, setLoading] = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [selectedCustomer, setSelectedCustomer] =
    useState<SelectedCustomer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CARD" | "TRANSFER"
  >("CASH");
  const [channel, setChannel] = useState<SaleChannelOption>("POS");
  const [distributorId, setDistributorId] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState("");
  const [lastSaleTotal, setLastSaleTotal] = useState<number | null>(null);
  const [flashProductId, setFlashProductId] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(
    null,
  );
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  const centralStockByProduct = useMemo(
    () =>
      new Map(
        products.map((product) => [product.id, Number(product.stockQuantity)]),
      ),
    [products],
  );

  const {
    data: distributorStock,
    isLoading: distributorStockLoading,
    error: distributorStockError,
  } = useQuery({
    queryKey: ["distributors", distributorId, "stock"],
    queryFn: () =>
      apiFetch<DistributorStock[]>(`/distributors/${distributorId}/stock`, {
        token: getAccessToken(),
      }),
    enabled: channel === "DISTRIBUTOR" && !!distributorId,
    staleTime: 30_000,
  });

  const distributorStockByProduct = useMemo(
    () =>
      new Map(
        (distributorStock ?? []).map((stock) => [
          stock.productId,
          Number(stock.quantity),
        ]),
      ),
    [distributorStock],
  );

  const stockForProduct = (productId: string) => {
    if (channel === "DISTRIBUTOR") {
      if (!distributorId) return 0;
      return distributorStockByProduct.get(productId) ?? 0;
    }
    return centralStockByProduct.get(productId) ?? 0;
  };

  const { isConnected } = useBarcodeScanner({
    enabled: !saleCompleted,
    onScan: (barcode: string) => {
      const product = products.find((p) => p.barcode === barcode);
      if (product) {
        const stock = stockForProduct(product.id);
        if (
          maxSaleQuantity(stock, 1, product.baseUnit ?? "UNIT", undefined) > 0
        ) {
          addItem(product);
          setFlashProductId(product.id);
          setTimeout(() => setFlashProductId(null), 400);
          playScanBeep();
        } else {
          playErrorBeep();
          addToast(
            `"${product.name}" no tiene stock disponible en este canal`,
            "error",
          );
        }
      } else {
        playErrorBeep();
        addToast(`Código ${barcode} no encontrado`, "error");
      }
    },
  });

  const productsForChannel = useMemo(
    () =>
      products.filter(
        (product) =>
          maxSaleQuantity(
            stockForProduct(product.id),
            1,
            product.baseUnit ?? "UNIT",
            undefined,
          ) > 0,
      ),
    [
      products,
      channel,
      distributorId,
      centralStockByProduct,
      distributorStockByProduct,
    ],
  );

  const availableProducts = useMemo(() => {
    if (!searchProduct) return productsForChannel;
    const query = searchProduct.toLowerCase();
    return productsForChannel.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query),
    );
  }, [productsForChannel, searchProduct]);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const couponDiscount = appliedCoupon
    ? roundMoney(
        Math.min(
          appliedCoupon.type === "PERCENTAGE"
            ? (subtotal * appliedCoupon.value) / 100
            : appliedCoupon.value,
          subtotal,
        ),
      )
    : 0;
  const discountAmount = appliedCoupon
    ? couponDiscount
    : roundMoney(subtotal * (discountPercent / 100));
  const total = roundMoney(subtotal - discountAmount);

  const addItem = (product: Product) => {
    const stock = stockForProduct(product.id);
    const baseUnit = product.baseUnit ?? "UNIT";
    const max = maxSaleQuantity(stock, 1, baseUnit, undefined);
    if (max <= 0) {
      addToast(
        channel === "DISTRIBUTOR" && !distributorId
          ? "Selecciona un distribuidor para consultar su stock"
          : `"${product.name}" no tiene stock disponible en este canal`,
        "error",
      );
      return;
    }
    const existingItem = items.find((i) => i.productId === product.id);
    if (existingItem) {
      const step = quantityStep(
        existingItem.baseUnit,
        existingItem.presentationId,
      );
      const quantity = normalizeSaleQuantity(
        existingItem.quantity + step,
        existingItem.stock,
        existingItem.factor,
        existingItem.baseUnit,
        existingItem.presentationId,
      );
      if (quantity <= existingItem.quantity) return;
      setItems(
        items.map((i) =>
          i.productId === product.id
            ? {
                ...i,
                quantity,
                total: roundMoney(quantity * i.unitPrice),
              }
            : i,
        ),
      );
    } else {
      const quantity = normalizeSaleQuantity(
        Math.min(1, max),
        stock,
        1,
        baseUnit,
        undefined,
      );
      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          productDescription: product.description,
          basePrice: Number(product.salePrice),
          presentations: product.presentations ?? [],
          baseUnit,
          presentationId: undefined,
          presentationName: undefined,
          factor: 1,
          unitPrice: Number(product.salePrice),
          quantity,
          total: roundMoney(quantity * Number(product.salePrice)),
          stock,
        },
      ]);
    }
  };

  const maxQuantityFor = (item: SaleItem) =>
    maxSaleQuantity(
      item.stock,
      item.factor,
      item.baseUnit,
      item.presentationId,
    );

  const changeItemPresentation = (
    productId: string,
    presentationId: string,
  ) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const presentation = item.presentations.find(
          (p) => p.id === presentationId,
        );
        const factor = presentation ? Number(presentation.factor) : 1;
        const unitPrice = presentation
          ? presentation.price
            ? Number(presentation.price)
            : item.basePrice * factor
          : item.basePrice;
        const max = maxSaleQuantity(
          item.stock,
          factor,
          item.baseUnit,
          presentation?.id,
        );
        if (max <= 0) return item;
        const quantity = normalizeSaleQuantity(
          item.quantity,
          item.stock,
          factor,
          item.baseUnit,
          presentation?.id,
        );
        return {
          ...item,
          presentationId: presentation?.id,
          presentationName: presentation?.name,
          factor,
          unitPrice,
          quantity,
          total: roundMoney(quantity * unitPrice),
        };
      }),
    );
  };

  const setItemQuantity = (productId: string, value: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const quantity = normalizeSaleQuantity(
          value,
          item.stock,
          item.factor,
          item.baseUnit,
          item.presentationId,
        );
        if (quantity <= 0) return item;
        return {
          ...item,
          quantity,
          total: roundMoney(quantity * item.unitPrice),
        };
      }),
    );
  };

  const updateQuantity = (productId: string, direction: -1 | 1) => {
    setItems(
      items.map((item) => {
        if (item.productId !== productId) return item;
        const step = quantityStep(item.baseUnit, item.presentationId);
        const quantity = normalizeSaleQuantity(
          item.quantity + direction * step,
          item.stock,
          item.factor,
          item.baseUnit,
          item.presentationId,
        );
        if (quantity <= 0 || quantity === item.quantity) return item;
        return {
          ...item,
          quantity,
          total: roundMoney(quantity * item.unitPrice),
        };
      }),
    );
  };

  const removeItem = (productId: string) => {
    setItems(items.filter((i) => i.productId !== productId));
  };

  const handleApplyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (subtotal <= 0) {
      setCouponError("Agrega productos antes de aplicar un cupón");
      return;
    }

    setCouponLoading(true);
    setCouponError(null);

    try {
      const result = await apiFetch<{
        coupon: { code: string; type: "PERCENTAGE" | "FIXED"; value: number };
        discountAmount: number;
      }>("/discounts/validate", {
        method: "POST",
        token: getAccessToken(),
        body: JSON.stringify({ code, subtotal }),
      });

      setAppliedCoupon(result.coupon);
      setDiscountPercent(0);
      addToast(`Cupón ${result.coupon.code} aplicado`, "success");
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err instanceof Error ? err.message : "Cupón no válido");
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError(null);
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      addToast("Debe agregar al menos un producto", "error");
      return;
    }

    if (channel === "DISTRIBUTOR" && !distributorId) {
      addToast(
        "Selecciona un distribuidor para el canal Distribuidor",
        "error",
      );
      return;
    }

    setLoading(true);

    const saleItems = items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      presentationId: i.presentationId,
    }));

    try {
      let result: { saleNumber: string; totalAmount?: number | string };

      if (channel === "DISTRIBUTOR") {
        result = await apiFetch<{
          saleNumber: string;
          totalAmount?: number | string;
        }>(`/distributors/${distributorId}/sales`, {
          method: "POST",
          token: getAccessToken(),
          body: JSON.stringify({
            customerId: selectedCustomer?.id || undefined,
            paymentMethod,
            items: saleItems,
            discountAmount,
          }),
        });
        queryClient.invalidateQueries({ queryKey: ["distributors"] });
      } else {
        result = await apiFetch<{
          saleNumber: string;
          totalAmount?: number | string;
        }>("/sales", {
          method: "POST",
          token: getAccessToken(),
          body: JSON.stringify({
            customerId: selectedCustomer?.id || undefined,
            paymentMethod,
            channel,
            items: saleItems,
            ...(appliedCoupon
              ? { couponCode: appliedCoupon.code }
              : { discountAmount }),
          }),
        });
      }

      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      const confirmedTotal =
        result.totalAmount !== undefined &&
        result.totalAmount !== null &&
        String(result.totalAmount).trim() !== ""
          ? Number(result.totalAmount)
          : NaN;
      setLastSaleNumber(result.saleNumber);
      setLastSaleTotal(
        Number.isFinite(confirmedTotal) && confirmedTotal >= 0
          ? confirmedTotal
          : null,
      );
      setSaleCompleted(true);
      addToast("Venta registrada correctamente", "success");
    } catch (err) {
      addToast(
        err instanceof Error ? err.message : "Error al registrar venta",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNewSale = () => {
    setItems([]);
    setSelectedCustomer(null);
    setPaymentMethod("CASH");
    setChannel("POS");
    setDistributorId("");
    setDiscountPercent(0);
    setCouponInput("");
    setAppliedCoupon(null);
    setCouponError(null);
    setSaleCompleted(false);
    setLastSaleNumber("");
    setLastSaleTotal(null);
  };

  if (saleCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Venta registrada
          </h2>
          <p className="text-muted-foreground mb-6">
            La venta se ha completado exitosamente
          </p>

          <div className="bg-muted rounded-xl p-4 mb-6">
            <p className="text-sm text-muted-foreground">Número de ticket</p>
            <p className="text-2xl font-bold text-foreground">
              {lastSaleNumber}
            </p>
            {lastSaleTotal !== null ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Total confirmado por el servidor:{" "}
                <span className="font-semibold text-foreground">
                  S/ {lastSaleTotal.toFixed(2)}
                </span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                La venta fue registrada, pero no se recibió su total confirmado.
                Consulta el detalle antes de cobrar.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push("/sales")}
              className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90"
            >
              Ver ventas
            </Button>
            <Button
              onClick={handleNewSale}
              variant="outline"
              className="w-full h-12 rounded-xl"
            >
              Nueva venta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <button
            onClick={() => router.push("/sales")}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a ventas
          </button>

          <div className="flex flex-wrap items-center gap-4">
            <div className="rounded-xl bg-accent/10 p-3">
              <ShoppingCart className="h-6 w-6 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Nueva Venta
              </h1>
              <p className="text-sm text-muted-foreground">
                Punto de venta &mdash; Registra una nueva transacci&oacute;n
              </p>
            </div>
            <ScannerStatus connected={isConnected} />
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Customer + Product grid */}
          <div className="lg:col-span-3 space-y-6">
            {/* Customer selection */}
            <div className="bg-card border border-border rounded-xl p-5 space-y-5">
              <div>
                <Label className="text-sm font-semibold text-foreground mb-3 block">
                  Cliente{" "}
                  <span className="text-muted-foreground font-normal">
                    (opcional)
                  </span>
                </Label>
                <CustomerSearch
                  customers={customers}
                  onSelect={(customer) => setSelectedCustomer(customer)}
                />
              </div>

              {customers.length > 0 && (
                <div className="border-t border-border pt-5">
                  <CustomerBoxSelector
                    customers={customers}
                    selectedId={selectedCustomer?.id ?? null}
                    onSelect={(customer) =>
                      setSelectedCustomer(
                        customer
                          ? {
                              id: customer.id,
                              firstName: customer.firstName,
                              lastName: customer.lastName ?? undefined,
                              documentType: customer.documentType ?? undefined,
                              documentValue:
                                customer.documentValue ?? undefined,
                              email: customer.email ?? undefined,
                              phone: customer.phone ?? undefined,
                            }
                          : null,
                      )
                    }
                  />
                </div>
              )}
            </div>

            {/* Product grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Productos
                </h2>
                <span className="text-sm text-muted-foreground">
                  {productsForChannel.length} disponibles
                </span>
              </div>

              {/* Product filter */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  placeholder="Filtrar productos por nombre, descripción o SKU..."
                  className="h-10 pl-10 rounded-lg"
                />
              </div>

              {/* Product cards */}
              {availableProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">
                    {channel === "DISTRIBUTOR" && !distributorId
                      ? "Selecciona un distribuidor para consultar su stock"
                      : channel === "DISTRIBUTOR" && distributorStockLoading
                        ? "Consultando stock del distribuidor..."
                        : channel === "DISTRIBUTOR"
                          ? "El distribuidor no tiene productos disponibles"
                          : "No se encontraron productos"}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addItem(product)}
                      className={`bg-card border border-border rounded-xl p-4 text-left hover:border-accent/40 hover:bg-accent/[0.02] transition-colors cursor-pointer min-h-[110px] flex flex-col justify-between ${
                        flashProductId === product.id
                          ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-400/30 animate-scan-flash"
                          : ""
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {product.sku || "\u2014"}
                        </p>
                        <p className="font-medium text-foreground text-sm leading-snug line-clamp-2">
                          {product.name}
                        </p>
                        {product.description && (
                          <p
                            className="text-xs text-muted-foreground leading-snug line-clamp-2"
                            title={product.description}
                          >
                            {product.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-lg font-bold text-foreground">
                          S/ {Number(product.salePrice).toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              stockForProduct(product.id) > 10
                                ? "bg-emerald-500"
                                : stockForProduct(product.id) > 0
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                          />
                          <span className="text-xs text-muted-foreground">
                            Stock: {stockForProduct(product.id)}{" "}
                            {UNIT_SHORT[product.baseUnit] ?? product.baseUnit}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Cart sidebar */}
          <div className="lg:col-span-2">
            <div className="bg-card border border-border rounded-xl sticky top-24">
              {/* Cart header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Carrito
                  </h2>
                  <span className="text-sm text-muted-foreground">
                    {items.length} items
                  </span>
                </div>
              </div>

              {/* Cart items */}
              <div className="p-5 space-y-3 max-h-[40vh] overflow-y-auto">
                {items.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Selecciona productos</p>
                  </div>
                ) : (
                  items.map((item) => (
                    <div
                      key={item.productId}
                      className="bg-muted rounded-xl p-3"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="font-medium text-sm text-foreground truncate">
                            {item.productName}
                          </p>
                          {item.productDescription && (
                            <p
                              className="text-xs text-muted-foreground truncate"
                              title={item.productDescription}
                            >
                              {item.productDescription}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            S/ {item.unitPrice.toFixed(2)} /{" "}
                            {item.presentationName ??
                              UNIT_SHORT[item.baseUnit] ??
                              item.baseUnit}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {item.presentations.length > 0 && (
                        <select
                          value={item.presentationId ?? ""}
                          onChange={(e) =>
                            changeItemPresentation(
                              item.productId,
                              e.target.value,
                            )
                          }
                          className="mb-2 h-9 w-full rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                        >
                          <option value="">
                            Unidad base (
                            {UNIT_SHORT[item.baseUnit] ?? item.baseUnit})
                          </option>
                          {item.presentations.map((presentation) => (
                            <option
                              key={presentation.id}
                              value={presentation.id}
                              disabled={
                                maxSaleQuantity(
                                  item.stock,
                                  Number(presentation.factor),
                                  item.baseUnit,
                                  presentation.id,
                                ) <= 0
                              }
                            >
                              {presentation.name} (&times;{" "}
                              {Number(presentation.factor)})
                            </option>
                          ))}
                        </select>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                            disabled={
                              item.quantity <=
                                quantityStep(
                                  item.baseUnit,
                                  item.presentationId,
                                ) || maxQuantityFor(item) <= 0
                            }
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <QuantityInput
                            value={item.quantity}
                            step={quantityStep(
                              item.baseUnit,
                              item.presentationId,
                            )}
                            max={maxQuantityFor(item)}
                            label={`Cantidad de ${item.productName}`}
                            onChange={(value) =>
                              setItemQuantity(item.productId, value)
                            }
                          />
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                            disabled={item.quantity >= maxQuantityFor(item)}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="font-bold text-foreground">
                          S/ {item.total.toFixed(2)}
                        </p>
                      </div>

                      {item.factor > 1 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          = {(item.quantity * item.factor).toFixed(3)}{" "}
                          {UNIT_SHORT[item.baseUnit] ?? item.baseUnit} de stock
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Channel */}
              <div className="px-5 pb-4">
                <Label className="text-sm font-semibold text-foreground mb-2 block">
                  Canal de venta
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["POS", Store, "Tienda"],
                      ["ONLINE", Globe, "Online"],
                      ["DISTRIBUTOR", Truck, "Distribuidor"],
                    ] as const
                  ).map(([value, Icon, label]) => {
                    const isActive = channel === value;
                    const isDisabled =
                      value === "DISTRIBUTOR" && distributors.length === 0;
                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (
                            value !== channel &&
                            (value === "DISTRIBUTOR" ||
                              channel === "DISTRIBUTOR")
                          ) {
                            setItems([]);
                          }
                          setChannel(value);
                          if (value !== "DISTRIBUTOR") {
                            setDistributorId("");
                          }
                          if (value === "DISTRIBUTOR") {
                            setAppliedCoupon(null);
                            setCouponInput("");
                            setCouponError(null);
                          }
                        }}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1.5 transition-colors ${
                          isDisabled
                            ? "cursor-not-allowed border-border opacity-40"
                            : isActive
                              ? "cursor-pointer border-accent bg-accent/5"
                              : "cursor-pointer border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${isActive ? "text-accent" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`text-xs font-medium ${isActive ? "text-accent" : "text-muted-foreground"}`}
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {channel === "DISTRIBUTOR" && (
                  <div className="mt-3 space-y-2">
                    <Label className="text-sm font-semibold text-foreground">
                      Distribuidor
                    </Label>
                    <select
                      value={distributorId}
                      onChange={(e) => {
                        setDistributorId(e.target.value);
                        setItems([]);
                      }}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    >
                      <option value="">Selecciona un distribuidor...</option>
                      {distributors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code}) &mdash; stock{" "}
                          {d.balance?.balanceQuantity ?? 0}
                        </option>
                      ))}
                    </select>
                    {distributorStockError && (
                      <p className="text-xs text-red-500">
                        No se pudo consultar el stock consignado.
                      </p>
                    )}
                    {distributorId &&
                      !distributorStockLoading &&
                      !distributorStockError &&
                      distributorStockByProduct.size === 0 && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          El distribuidor no tiene stock consignado disponible.
                        </p>
                      )}
                    <p className="text-xs text-muted-foreground">
                      La venta se registra contra la mercader&iacute;a en
                      consigna del distribuidor y suma a su deuda.
                    </p>
                  </div>
                )}
              </div>

              {/* Payment method */}
              <div className="px-5 pb-4">
                <Label className="text-sm font-semibold text-foreground mb-2 block">
                  M&eacute;todo de pago
                </Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(
                    [
                      ["CASH", Banknote, "Efectivo"],
                      ["CARD", CreditCard, "Tarjeta"],
                      ["TRANSFER", Building2, "Transferencia"],
                    ] as const
                  ).map(([method, Icon, label]) => {
                    const isActive = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                          isActive
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-muted-foreground/30"
                        }`}
                      >
                        <Icon
                          className={`h-5 w-5 ${isActive ? "text-accent" : "text-muted-foreground"}`}
                        />
                        <span
                          className={`text-xs font-medium ${isActive ? "text-accent" : "text-muted-foreground"}`}
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coupon */}
              {channel !== "DISTRIBUTOR" && (
                <PermissionGuard permission="discount:list">
                  <div className="px-5 pb-4 space-y-2">
                    <Label className="text-sm font-semibold text-foreground mb-2 block">
                      Cupón de descuento
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={couponInput}
                        onChange={(e) =>
                          setCouponInput(e.target.value.toUpperCase())
                        }
                        placeholder="VERANO10"
                        maxLength={32}
                        disabled={!!appliedCoupon}
                        className="h-10 rounded-lg font-mono uppercase tracking-widest"
                      />
                      {appliedCoupon ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleRemoveCoupon}
                          className="h-10 shrink-0 rounded-lg"
                        >
                          <X className="mr-1 h-4 w-4" />
                          Quitar
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleApplyCoupon}
                          disabled={couponLoading || !couponInput.trim()}
                          className="h-10 shrink-0 rounded-lg"
                        >
                          {couponLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            "Aplicar"
                          )}
                        </Button>
                      )}
                    </div>
                    {appliedCoupon && (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <TicketPercent className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          {appliedCoupon.code} ·{" "}
                          {appliedCoupon.type === "PERCENTAGE"
                            ? `${appliedCoupon.value}% de descuento`
                            : `S/ ${appliedCoupon.value.toFixed(2)} de descuento`}
                        </span>
                      </div>
                    )}
                    {couponError && (
                      <p className="text-xs text-red-500">{couponError}</p>
                    )}
                  </div>
                </PermissionGuard>
              )}

              {/* Discount */}
              <div className="px-5 pb-4">
                <Label className="text-sm font-semibold text-foreground mb-2 block">
                  Descuento{" "}
                  <span className="text-muted-foreground font-normal">(%)</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) =>
                    setDiscountPercent(
                      Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                    )
                  }
                  disabled={!!appliedCoupon}
                  className="h-10 rounded-lg"
                />
                {!!appliedCoupon && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    El descuento lo define el cupón aplicado.
                  </p>
                )}
              </div>

              {/* Totals + Submit */}
              <div className="border-t border-border p-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>S/ {subtotal.toFixed(2)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                      <span>
                        {appliedCoupon
                          ? `Cupón ${appliedCoupon.code}`
                          : `Descuento (${discountPercent}%)`}
                      </span>
                      <span>-S/ {discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-foreground pt-2 border-t border-border">
                    <span>Total</span>
                    <span>S/ {total.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={loading || items.length === 0}
                  className="w-full h-12 rounded-lg bg-foreground text-background text-base font-semibold hover:bg-foreground/90 transition-colors"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Receipt className="mr-2 h-5 w-5" />
                      Registrar venta
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
