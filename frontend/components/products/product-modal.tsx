'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Image as ImageIcon, X, Package, Barcode, Tag, DollarSign, Boxes, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';
import type { Category, Product } from '@/types/api';

interface ProductModalProps {
  product?: Product | null;
  categories: Category[];
  children?: React.ReactNode;
}

export function ProductModal({ product, categories, children }: ProductModalProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!product;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor selecciona un archivo de imagen');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('La imagen no debe exceder 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImagePreview(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      barcode: formData.get('barcode') || null,
      description: formData.get('description') || null,
      costPrice: formData.get('costPrice'),
      salePrice: formData.get('salePrice'),
      stockQuantity: parseInt(formData.get('stockQuantity') as string) || 0,
      minStock: parseInt(formData.get('minStock') as string) || 5,
      categoryId: formData.get('categoryId') || null,
      imageUrl: imagePreview,
    };

    try {
      const url = isEdit ? `/products/${product.id}` : '/products';
      const method = isEdit ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['products'] });
      router.refresh();
      addToast(isEdit ? 'Producto actualizado correctamente' : 'Producto creado correctamente', 'success');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      addToast(err instanceof Error ? err.message : 'Error al guardar producto', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <button className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600">
            <Package className="size-4" />
            Nuevo producto
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden rounded-2xl bg-white p-0">
        <DialogHeader className="border-b border-slate-100 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 shadow-lg shadow-emerald-500/20">
                  <Package className="size-6 text-white" />
                </div>
                <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400"></div>
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-slate-900 tracking-tight">
                  {isEdit ? 'Editar producto' : 'Nuevo producto'}
                </DialogTitle>
                <p className="text-sm text-slate-500 mt-1 font-medium">
                  {isEdit ? 'Actualiza la información del producto' : 'Completa los datos para registrar un nuevo producto'}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="rounded-xl p-2.5 hover:bg-slate-100 transition-colors">
              <X className="size-5 text-slate-400" />
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)]">
          {error && (
            <div className="mx-8 mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100 flex items-center gap-3">
              <AlertTriangle className="size-5 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-0">
            {/* Left Column - Image */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-6 md:p-8 md:border-r border-slate-100">
              <div className="sticky top-0">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 block">Imagen del producto</Label>
                
                <div className="relative group">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-white flex items-center justify-center transition-all group-hover:border-emerald-300">
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white font-medium">Cambiar imagen</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 p-8">
                        <div className="h-20 w-20 rounded-full bg-slate-100 flex items-center justify-center">
                          <ImageIcon className="h-10 w-10 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-400 text-center">Arrastra una imagen o haz clic para subir</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                <div className="mt-6 space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-10 rounded-xl border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {imagePreview ? 'Cambiar imagen' : 'Subir imagen'}
                  </Button>
                  {imagePreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setImagePreview(null)}
                      className="w-full h-10 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      Eliminar imagen
                    </Button>
                  )}
                  <p className="text-xs text-slate-400 text-center">PNG, JPG hasta 2MB • Max 1080x1080px</p>
                </div>

                {/* Quick Stats Preview */}
                {isEdit && (
                  <div className="mt-8 p-4 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Estado actual</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Stock</span>
                        <span className={`font-bold ${(product?.stockQuantity ?? 0) < (product?.minStock ?? 5) ? 'text-red-500' : 'text-slate-900'}`}>
                          {product?.stockQuantity ?? 0} unidades
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Precio</span>
                        <span className="font-bold text-slate-900">S/ {parseFloat(String(product?.salePrice || '0')).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="p-6 md:p-8">
              <div className="space-y-8">
                {/* Basic Info Section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Tag className="size-4" />
                    Información básica
                  </p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold text-slate-700">Nombre del producto *</Label>
                      <Input 
                        id="name" 
                        name="name" 
                        required 
                        defaultValue={product?.name ?? ''} 
                        placeholder="Ej: Café Premium Supremo"
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sku" className="text-sm font-semibold text-slate-700">SKU</Label>
                        <div className="relative">
                          <Input 
                            id="sku" 
                            name="sku" 
                            defaultValue={product?.sku ?? ''} 
                            placeholder="ACM-001"
                            disabled={isEdit}
                            className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 ${isEdit ? 'bg-slate-100 text-slate-400' : 'focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'}`}
                          />
                          <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        </div>
                        {isEdit && <p className="text-xs text-slate-400">El SKU no se puede modificar</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="barcode" className="text-sm font-semibold text-slate-700">Código de barras</Label>
                        <div className="relative">
                          <Input 
                            id="barcode" 
                            name="barcode" 
                            defaultValue={product?.barcode || ''} 
                            placeholder="100000000001"
                            className="h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                          />
                          <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="categoryId" className="text-sm font-semibold text-slate-700">Categoría</Label>
                      <div className="relative">
                        <select
                          id="categoryId"
                          name="categoryId"
                          defaultValue={product?.categoryId || ''}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                        >
                          <option value="">Seleccionar categoría...</option>
                          {categories.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                        <Tag className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-sm font-semibold text-slate-700">Descripción</Label>
                      <textarea
                        id="description" 
                        name="description" 
                        defaultValue={product?.description || ''} 
                        placeholder="Descripción detallada del producto..."
                        rows={3}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing Section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <DollarSign className="size-4" />
                    Precios y costos
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="costPrice" className="text-sm font-semibold text-slate-700">Precio de costo</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">S/</span>
                        <Input 
                          id="costPrice" 
                          name="costPrice" 
                          type="number" 
                          step="0.01" 
                          required 
                          defaultValue={product?.costPrice ?? ''} 
                          placeholder="0.00"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-12 pr-4 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salePrice" className="text-sm font-semibold text-slate-700">Precio de venta *</Label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">S/</span>
                        <Input 
                          id="salePrice" 
                          name="salePrice" 
                          type="number" 
                          step="0.01" 
                          required 
                          defaultValue={product?.salePrice ?? ''} 
                          placeholder="0.00"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-12 pr-4 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Stock Section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Boxes className="size-4" />
                    Inventario
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stockQuantity" className="text-sm font-semibold text-slate-700">Stock inicial</Label>
                      <Input 
                        id="stockQuantity" 
                        name="stockQuantity" 
                        type="number" 
                        defaultValue={product?.stockQuantity || 0} 
                        placeholder="0"
                        className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minStock" className="text-sm font-semibold text-slate-700">Stock mínimo</Label>
                      <div className="relative">
                        <Input 
                          id="minStock" 
                          name="minStock" 
                          type="number" 
                          defaultValue={product?.minStock || 5} 
                          placeholder="5"
                          className="h-12 rounded-xl border-slate-200 bg-slate-50/50 pr-10 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                        <AlertTriangle className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-400">Recibirás una alerta cuando el stock baje de este nivel</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 mt-8 flex items-center justify-between gap-4 border-t border-slate-100 bg-white px-8 py-5">
            <p className="text-xs text-slate-400">Los campos marcados con * son obligatorios</p>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={handleClose} className="h-12 rounded-xl px-6 border-slate-200 hover:bg-slate-50">
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 font-semibold hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
