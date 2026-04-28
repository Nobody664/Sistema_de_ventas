'use client';

import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Minus, Trash2, ShoppingCart, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import type { Product, Customer } from '@/types/api';

interface SaleItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  total: number;
}

interface NewSaleModalProps {
  products: Product[];
  customers: Customer[];
}

export function NewSaleModal({ products, customers }: NewSaleModalProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'TRANSFER'>('CASH');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);

  const availableProducts = useMemo(() => {
    if (!searchProduct) return products.filter(p => p.stockQuantity > 0);
    return products.filter(
      p => p.stockQuantity > 0 && 
      (p.name.toLowerCase().includes(searchProduct.toLowerCase()) || 
       p.sku?.toLowerCase().includes(searchProduct.toLowerCase()))
    );
  }, [products, searchProduct]);

  const subtotal = items.reduce((acc, item) => acc + item.total, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxAmount = (subtotal - discountAmount) * 0.18;
  const total = subtotal - discountAmount + taxAmount;

  const addItem = (product: Product) => {
    const existing = items.find(i => i.productId === product.id);
    if (existing) {
      if (existing.quantity < product.stockQuantity) {
        setItems(items.map(i => 
          i.productId === product.id 
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
            : i
        ));
      }
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          unitPrice: Number(product.salePrice),
          quantity: 1,
          total: Number(product.salePrice),
        },
      ]);
    }
    setSearchProduct('');
    setShowProductSearch(false);
  };

  const updateQuantity = (productId: string, delta: number) => {
    const item = items.find(i => i.productId === productId);
    const product = products.find(p => p.id === productId);
    if (!item || !product) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setItems(items.filter(i => i.productId !== productId));
    } else if (newQty <= product.stockQuantity) {
      setItems(items.map(i => 
        i.productId === productId 
          ? { ...i, quantity: newQty, total: newQty * i.unitPrice }
          : i
      ));
    }
  };

  const removeItem = (productId: string) => {
    setItems(items.filter(i => i.productId !== productId));
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      addToast('Agrega al menos un producto', 'error');
      return;
    }

    setLoading(true);

    const data = {
      customerId: selectedCustomer || undefined,
      paymentMethod,
      discountAmount: discountAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      items: items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
    };

    try {
      await apiFetch('/sales', {
        method: 'POST',
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['sales'] });
      router.refresh();
      addToast('Venta registrada correctamente', 'success');
      setOpen(false);
      setItems([]);
      setSelectedCustomer('');
      setDiscountPercent(0);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Error al registrar venta', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setItems([]);
    setSelectedCustomer('');
    setDiscountPercent(0);
    setSearchProduct('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button 
          className="flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-orange-600 shadow-lg transition hover:bg-white/95 hover:shadow-xl"
        >
          <ShoppingCart className="size-5" />
          <span className="hidden sm:inline">Nueva venta</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl p-0 bg-slate-50 max-h-[90vh] overflow-hidden">
        <DialogHeader className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-orange-100 p-2">
                <ShoppingCart className="size-6 text-orange-600" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900">Nueva Venta</DialogTitle>
                <p className="text-sm text-slate-500">Selecciona los productos</p>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2 overflow-auto max-h-[calc(90vh-180px)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Buscar producto</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-12 rounded-xl border-slate-300 pl-10 text-slate-900 placeholder:text-slate-400 bg-white"
                  placeholder="Buscar por nombre o SKU..."
                  value={searchProduct}
                  onChange={(e) => {
                    setSearchProduct(e.target.value);
                    setShowProductSearch(true);
                  }}
                  onFocus={() => setShowProductSearch(true)}
                />
              </div>
              {showProductSearch && searchProduct && (
                <div className="max-h-60 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {availableProducts.length > 0 ? (
                    availableProducts.slice(0, 8).map(product => (
                      <button
                        key={product.id}
                        onClick={() => addItem(product)}
                        className="flex w-full items-center justify-between p-4 text-left hover:bg-slate-50"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{product.name}</p>
                          <p className="text-sm text-slate-500">SKU: {product.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-orange-600">S/ {product.salePrice}</p>
                          <p className="text-sm text-slate-500">Stock: {product.stockQuantity}</p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="p-4 text-center text-slate-500">No hay productos disponibles</p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Cliente (opcional)</label>
              <select
                value={selectedCustomer}
                onChange={(e) => setSelectedCustomer(e.target.value)}
                className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900"
              >
                <option value="">Cliente general</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.firstName} {customer.lastName || ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Método de pago</label>
              <div className="flex gap-2">
                {(['CASH', 'CARD', 'TRANSFER'] as const).map(method => (
                  <button
                    key={method}
                    onClick={() => setPaymentMethod(method)}
                    className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${
                      paymentMethod === method
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {method === 'CASH' && 'Efectivo'}
                    {method === 'CARD' && 'Tarjeta'}
                    {method === 'TRANSFER' && 'Transferencia'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Productos ({items.length})</span>
              <button
                onClick={() => setItems([])}
                className="text-sm font-medium text-red-600 hover:text-red-700"
              >
                Limpiar todo
              </button>
            </div>

            <div className="max-h-64 space-y-2 overflow-auto">
              {items.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  <ShoppingCart className="mx-auto mb-2 size-8" />
                  <p>Agrega productos desde el panel izquierdo</p>
                </div>
              ) : (
                items.map(item => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-slate-900">{item.productName}</p>
                      <p className="text-sm text-slate-500">S/ {item.unitPrice.toFixed(2)} c/u</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100"
                      >
                        <Minus className="size-4 text-slate-600" />
                      </button>
                      <span className="w-8 text-center font-bold text-slate-900">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-100"
                      >
                        <Plus className="size-4 text-slate-600" />
                      </button>
                    </div>
                    <div className="ml-3 w-20 text-right">
                      <p className="font-bold text-slate-900">S/ {item.total.toFixed(2)}</p>
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-semibold text-slate-900">S/ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Descuento ({discountPercent}%)</span>
                <span className="font-semibold text-red-600">- S/ {discountAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">IGV (18%)</span>
                <span className="font-semibold text-slate-900">S/ {taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-bold">
                <span className="text-slate-900">Total</span>
                <span className="text-orange-600">S/ {total.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="mt-2 w-full accent-orange-500"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4">
          <Button variant="outline" onClick={handleClose} className="rounded-xl">
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={loading || items.length === 0}
            className="rounded-xl bg-orange-500 px-8 py-3 font-semibold hover:bg-orange-600"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Registrar Venta
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
