'use client';

import { useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Image as ImageIcon, Package, Barcode, Tag, DollarSign, Boxes, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { handleLimitError } from '@/lib/handle-limit-error';
import { useUiStore } from '@/store/ui-store';
import { createProductSchema } from '@/lib/validations/product.validation';
import type { Category, Product } from '@/types/api';
import { z } from 'zod';

type ProductFormData = z.infer<typeof createProductSchema>;

interface ProductFormProps {
  product?: Product | null;
  categories: Category[];
}

export function ProductForm({ product, categories }: ProductFormProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl || null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get('name') as string,
      sku: (formData.get('sku') as string) || undefined,
      barcode: (formData.get('barcode') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
      costPrice: parseFloat(formData.get('costPrice') as string) || 0,
      salePrice: parseFloat(formData.get('salePrice') as string) || 0,
      stockQuantity: parseInt(formData.get('stockQuantity') as string) || 0,
      minStock: parseInt(formData.get('minStock') as string) || 5,
      categoryId: (formData.get('categoryId') as string) || undefined,
      imageUrl: imagePreview || undefined,
    };

    const result = createProductSchema.safeParse(data);

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field) {
          errors[field as string] = issue.message;
        }
      });
      setFieldErrors(errors);
      setLoading(false);
      return;
    }

    try {
      const url = isEdit ? `/products/${product.id}` : '/products';
      const method = isEdit ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['products'] });
      addToast(isEdit ? 'Producto actualizado correctamente' : 'Producto creado correctamente', 'success');
      router.push('/products');
    } catch (err: unknown) {
      const { message, isLimitError } = handleLimitError(err);
      setError(message);
      addToast(message, isLimitError ? 'info' : 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbf6ef]">
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/products')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a productos
          </button>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 shadow-lg shadow-emerald-500/20">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isEdit ? 'Editar producto' : 'Nuevo producto'}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {isEdit ? 'Actualiza la información del producto' : 'Completa los datos para registrar un nuevo producto'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          {error && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-600 border border-red-100 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-8">
            {/* Left Column - Image */}
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-6 md:p-8 rounded-2xl border border-slate-200">
              <div className="sticky top-8">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 block">
                  Imagen del producto
                </Label>
                
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
                  <p className="text-xs text-slate-400 text-center">PNG, JPG hasta 2MB</p>
                </div>

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
            <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8">
              <div className="space-y-8">
                {/* Basic Info Section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Información básica
                  </p>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                        Nombre del producto *
                      </Label>
                      <Input 
                        id="name" 
                        name="name"
                        defaultValue={product?.name || ''}
                        placeholder="Ej: Café Premium Supremo"
                        className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${fieldErrors.name ? 'border-red-500' : ''}`}
                      />
                      {fieldErrors.name && (
                        <p className="text-sm text-red-500">{fieldErrors.name}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sku" className="text-sm font-semibold text-slate-700">SKU</Label>
                        <div className="relative">
                          <Input 
                            id="sku" 
                            name="sku"
                            defaultValue={product?.sku || ''}
                            placeholder="ACM-001"
                            disabled={isEdit}
                            className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 ${isEdit ? 'bg-slate-100 text-slate-400' : 'focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'} ${fieldErrors.sku ? 'border-red-500' : ''}`}
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
                            className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-10 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${fieldErrors.barcode ? 'border-red-500' : ''}`}
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
                          className={`h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer ${fieldErrors.categoryId ? 'border-red-500' : ''}`}
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
                        className={`w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none ${fieldErrors.description ? 'border-red-500' : ''}`}
                      />
                    </div>
                  </div>
                </div>

                {/* Pricing Section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
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
                          defaultValue={product?.costPrice || 0}
                          placeholder="0.00"
                          className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-12 pr-4 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${fieldErrors.costPrice ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {fieldErrors.costPrice && (
                        <p className="text-sm text-red-500">{fieldErrors.costPrice}</p>
                      )}
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
                          defaultValue={product?.salePrice || 0}
                          placeholder="0.00"
                          className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pl-12 pr-4 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${fieldErrors.salePrice ? 'border-red-500' : ''}`}
                        />
                      </div>
                      {fieldErrors.salePrice && (
                        <p className="text-sm text-red-500">{fieldErrors.salePrice}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stock Section */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                    <Boxes className="h-4 w-4" />
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
                        className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${fieldErrors.stockQuantity ? 'border-red-500' : ''}`}
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
                          className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 pr-10 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${fieldErrors.minStock ? 'border-red-500' : ''}`}
                        />
                        <AlertTriangle className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                      </div>
                      <p className="text-xs text-slate-400">Recibirás una alerta cuando baje de este nivel</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Los campos marcados con * son obligatorios</p>
            <div className="flex items-center gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push('/products')} 
                className="h-12 rounded-xl px-6 border-slate-200 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 font-semibold hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear producto'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
