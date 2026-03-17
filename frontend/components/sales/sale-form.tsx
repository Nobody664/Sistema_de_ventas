'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Minus, Trash2, ShoppingCart, Search, ArrowLeft, Banknote, CreditCard, Building2, Check, Printer, Receipt, User, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import { CustomerSearch } from '@/components/ui/customer-search';
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
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);

  const [loading, setLoading] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [saleCompleted, setSaleCompleted] = useState(false);
  const [lastSaleNumber, setLastSaleNumber] = useState('');

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
    setSearchProduct('');
    setShowProductSearch(false);
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
      discountPercent,
    };

    try {
      const result = await apiFetch<{ saleNumber: string }>('/sales', {
        method: 'POST',
        token: session?.accessToken,
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
      <div className="min-h-screen bg-[#fbf6ef] flex items-center justify-center">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-xl max-w-md w-full mx-4 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">¡Venta registrada!</h2>
          <p className="text-slate-500 mb-6">La venta se ha completado exitosamente</p>
          
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-500">Número de ticket</p>
            <p className="text-2xl font-bold text-slate-900">{lastSaleNumber}</p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => router.push('/sales')}
              className="w-full h-12 rounded-xl bg-slate-900 text-white"
            >
              Ver ventas
            </Button>
            <Button
              onClick={handleNewSale}
              className="w-full h-12 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"
            >
              Nueva venta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf6ef]">
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/sales')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a ventas
          </button>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 shadow-lg shadow-emerald-500/20">
                <ShoppingCart className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nueva Venta</h1>
              <p className="text-sm text-slate-500 font-medium">Punto de venta - Registra una nueva transacción</p>
            </div>
          </div>
        </div>

        {/* Selector de Empresa */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Products */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Search */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <Label className="text-sm font-semibold text-slate-700 mb-3 block">Buscar producto</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input 
                  value={searchProduct}
                  onChange={(e) => {
                    setSearchProduct(e.target.value);
                    setShowProductSearch(true);
                  }}
                  onFocus={() => setShowProductSearch(true)}
                  placeholder="Buscar por nombre o SKU..."
                  className="h-12 rounded-xl border-slate-200 bg-slate-50 pl-12 focus:bg-white focus:border-emerald-500"
                />
              </div>
              
              {showProductSearch && availableProducts.length > 0 && (
                <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                  {availableProducts.slice(0, 8).map(product => (
                    <button
                      key={product.id}
                      onClick={() => addItem(product)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{product.name}</p>
                        <p className="text-sm text-slate-500">Stock: {product.stockQuantity}</p>
                      </div>
                      <p className="font-bold text-emerald-600">S/ {Number(product.salePrice).toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Items */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-semibold text-slate-700">Productos agregados</Label>
                <span className="text-sm text-slate-500">{items.length} items</span>
              </div>
              
              {items.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Agrega productos desde el buscador</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.productId} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{item.productName}</p>
                        <p className="text-sm text-slate-500">S/ {item.unitPrice.toFixed(2)} c/u</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.productId, -1)}
                          className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, 1)}
                          className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center hover:bg-slate-50"
                          disabled={item.quantity >= item.stock}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="w-20 text-right font-bold text-slate-900">S/ {item.total.toFixed(2)}</p>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="space-y-6">
            {/* Customer */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <Label className="text-sm font-semibold text-slate-700 mb-3 block">Cliente (opcional)</Label>
              <CustomerSearch 
                customers={customers}
                onSelect={(customer) => setSelectedCustomer(customer)}
              />
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <Label className="text-sm font-semibold text-slate-700 mb-3 block">Método de pago</Label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setPaymentMethod('CASH')}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    paymentMethod === 'CASH' 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Banknote className={`h-6 w-6 ${paymentMethod === 'CASH' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${paymentMethod === 'CASH' ? 'text-emerald-600' : 'text-slate-500'}`}>Efectivo</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('CARD')}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    paymentMethod === 'CARD' 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <CreditCard className={`h-6 w-6 ${paymentMethod === 'CARD' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${paymentMethod === 'CARD' ? 'text-emerald-600' : 'text-slate-500'}`}>Tarjeta</span>
                </button>
                <button
                  onClick={() => setPaymentMethod('TRANSFER')}
                  className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                    paymentMethod === 'TRANSFER' 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Building2 className={`h-6 w-6 ${paymentMethod === 'TRANSFER' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${paymentMethod === 'TRANSFER' ? 'text-emerald-600' : 'text-slate-500'}`}>Transferencia</span>
                </button>
              </div>
            </div>

            {/* Discount */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <Label className="text-sm font-semibold text-slate-700 mb-3 block">Descuento (%)</Label>
              <Input 
                type="number"
                min="0"
                max="100"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="h-12 rounded-xl border-slate-200 bg-slate-50"
              />
            </div>

            {/* Totals */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>S/ {subtotal.toFixed(2)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Descuento ({discountPercent}%)</span>
                    <span>-S/ {discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-slate-900 pt-3 border-t">
                  <span>Total</span>
                  <span>S/ {total.toFixed(2)}</span>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={loading || items.length === 0}
                className="w-full h-14 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-lg font-semibold hover:from-emerald-600 hover:to-teal-700"
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
  );
}
