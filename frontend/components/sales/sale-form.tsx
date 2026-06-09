'use client';

import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Minus, Trash2, ShoppingCart, Search, ArrowLeft, Banknote, CreditCard, Building2, Check, Receipt, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, getAccessToken } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import { useAuthStore } from '@/stores/auth.store';
import { CustomerSearch } from '@/components/ui/customer-search';
import { CustomerBoxSelector } from '@/components/ui/customer-box-selector';
import { useBarcodeScanner } from '@/components/scanner/hooks/useBarcodeScanner';
import { ScannerStatus } from '@/components/scanner/components/scanner-status';
import { playScanBeep, playErrorBeep } from '@/components/scanner/services/sound';
import type { Product, Customer } from '@/types/api';

interface SaleItem {
  productId: string;
  productName: string;
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

interface SaleFormProps {
  products: Product[];
  customers: Customer[];
}

export function SaleForm({ products, customers }: SaleFormProps) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);

  const [loading, setLoading] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState('');
  const [flashProductId, setFlashProductId] = useState<string | null>(null);

  const { isConnected } = useBarcodeScanner({
    enabled: !saleCompleted,
    onScan: (barcode: string) => {
      const product = products.find((p) => p.barcode === barcode);
      if (product) {
        if (product.stockQuantity > 0) {
          addItem(product);
          setFlashProductId(product.id);
          setTimeout(() => setFlashProductId(null), 400);
          playScanBeep();
        } else {
          playErrorBeep();
          addToast(`"${product.name}" no tiene stock disponible`, 'error');
        }
      } else {
        playErrorBeep();
        addToast(`Código ${barcode} no encontrado`, 'error');
      }
    },
  });

  const availableProducts = useMemo(() => {
    if (!searchProduct) return products.filter(p => p.stockQuantity > 0);
    return products.filter(p =>
      p.stockQuantity > 0 &&
      (p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
       p.sku?.toLowerCase().includes(searchProduct.toLowerCase()))
    );
  }, [products, searchProduct]);

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal - discountAmount;

  const addItem = (product: Product) => {
    const existingItem = items.find(i => i.productId === product.id);
    if (existingItem) {
      if (existingItem.quantity < product.stockQuantity) {
        setItems(items.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
            : i
        ));
      }
    } else {
      setItems([...items, {
        productId: product.id,
        productName: product.name,
        unitPrice: Number(product.salePrice),
        quantity: 1,
        total: Number(product.salePrice),
        stock: product.stockQuantity,
      }]);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setItems(items.map(item => {
      if (item.productId === productId) {
        const newQty = item.quantity + delta;
        if (newQty < 1) return item;
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty, total: newQty * item.unitPrice };
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      addToast('Debe agregar al menos un producto', 'error');
      return;
    }

    setLoading(true);

    const data = {
      customerId: selectedCustomer?.id || undefined,
      paymentMethod,
      items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      discountAmount,
    };

    try {
      const result = await apiFetch<{ saleNumber: string }>('/sales', {
        method: 'POST',
        token: getAccessToken(),
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      setLastSaleNumber(result.saleNumber);
      setSaleCompleted(true);
      addToast('Venta registrada correctamente', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al registrar venta', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleNewSale = () => {
    setItems([]);
    setSelectedCustomer(null);
    setPaymentMethod('CASH');
    setDiscountPercent(0);
    setSaleCompleted(false);
    setLastSaleNumber('');
  };

  if (saleCompleted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Venta registrada</h2>
          <p className="text-muted-foreground mb-6">La venta se ha completado exitosamente</p>

          <div className="bg-muted rounded-xl p-4 mb-6">
            <p className="text-sm text-muted-foreground">Número de ticket</p>
            <p className="text-2xl font-bold text-foreground">{lastSaleNumber}</p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/sales')}
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
            onClick={() => router.push('/sales')}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a ventas
          </button>

          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-accent/10 p-3">
              <ShoppingCart className="h-6 w-6 text-accent" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Nueva Venta</h1>
              <p className="text-sm text-muted-foreground">Punto de venta &mdash; Registra una nueva transacci&oacute;n</p>
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
                  Cliente <span className="text-muted-foreground font-normal">(opcional)</span>
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
                              documentValue: customer.documentValue ?? undefined,
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
                <h2 className="text-lg font-semibold text-foreground">Productos</h2>
                <span className="text-sm text-muted-foreground">
                  {products.filter(p => p.stockQuantity > 0).length} disponibles
                </span>
              </div>

              {/* Product filter */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  placeholder="Filtrar productos por nombre o SKU..."
                  className="h-10 pl-10 rounded-lg"
                />
              </div>

              {/* Product cards */}
              {availableProducts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No se encontraron productos</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableProducts.map(product => (
                    <button
                      key={product.id}
                      onClick={() => addItem(product)}
                      className={`bg-card border border-border rounded-xl p-4 text-left hover:border-accent/40 hover:bg-accent/[0.02] transition-colors cursor-pointer min-h-[110px] flex flex-col justify-between ${
                        flashProductId === product.id ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-400/30 animate-scan-flash' : ''
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {product.sku || '\u2014'}
                        </p>
                        <p className="font-medium text-foreground text-sm leading-snug line-clamp-2">
                          {product.name}
                        </p>
                      </div>
                      <div className="mt-2 space-y-1">
                        <p className="text-lg font-bold text-foreground">
                          S/ {Number(product.salePrice).toFixed(2)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            product.stockQuantity > 10
                              ? 'bg-emerald-500'
                              : product.stockQuantity > 0
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                          }`} />
                          <span className="text-xs text-muted-foreground">
                            Stock: {product.stockQuantity}
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
                  <span className="text-sm text-muted-foreground">{items.length} items</span>
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
                  items.map(item => (
                    <div key={item.productId} className="bg-muted rounded-xl p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 mr-2">
                          <p className="font-medium text-sm text-foreground truncate">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">S/ {item.unitPrice.toFixed(2)} c/u</p>
                        </div>
                        <button
                          onClick={() => removeItem(item.productId)}
                          className="shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(item.productId, -1)}
                            className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center font-semibold text-foreground text-sm">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.productId, 1)}
                            className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-30"
                            disabled={item.quantity >= item.stock}
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="font-bold text-foreground">S/ {item.total.toFixed(2)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Payment method */}
              <div className="px-5 pb-4">
                <Label className="text-sm font-semibold text-foreground mb-2 block">M&eacute;todo de pago</Label>
                <div className="grid grid-cols-3 gap-2">
                  {([['CASH', Banknote, 'Efectivo'], ['CARD', CreditCard, 'Tarjeta'], ['TRANSFER', Building2, 'Transferencia']] as const).map(([method, Icon, label]) => {
                    const isActive = paymentMethod === method;
                    return (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
                        className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1.5 transition-colors cursor-pointer ${
                          isActive
                            ? 'border-accent bg-accent/5'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <Icon className={`h-5 w-5 ${isActive ? 'text-accent' : 'text-muted-foreground'}`} />
                        <span className={`text-xs font-medium ${isActive ? 'text-accent' : 'text-muted-foreground'}`}>
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Discount */}
              <div className="px-5 pb-4">
                <Label className="text-sm font-semibold text-foreground mb-2 block">
                  Descuento <span className="text-muted-foreground font-normal">(%)</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="h-10 rounded-lg"
                />
              </div>

              {/* Totals + Submit */}
              <div className="border-t border-border p-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Subtotal</span>
                    <span>S/ {subtotal.toFixed(2)}</span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                      <span>Descuento ({discountPercent}%)</span>
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
