'use client';

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Image as ImageIcon, Package, Barcode, Tag, Banknote, Boxes, AlertTriangle, ArrowLeft, QrCode, Plus, Trash2, Layers, Ruler } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch, getAccessToken } from '@/lib/api';
import { handleLimitError } from '@/lib/handle-limit-error';
import { BarcodeScanner } from '@/components/ui/barcode-scanner';
import { useUiStore } from '@/store/ui-store';
import { useAuthStore } from '@/stores/auth.store';
import { createProductSchema } from '@/lib/validations/product.validation';
import type { Category, Product } from '@/types/api';
import { z } from 'zod';

type ProductFormData = z.infer<typeof createProductSchema>;

type UnitValue = 'UNIT' | 'KG' | 'LT' | 'MT';

interface PresentationRow {
  id?: string;
  name: string;
  factor: string;
  price: string;
  barcode: string;
  isActive: boolean;
}

const UNIT_OPTIONS: Array<{ value: UnitValue; label: string; short: string }> = [
  { value: 'UNIT', label: 'Unidad', short: 'und' },
  { value: 'KG', label: 'Kilogramo', short: 'kg' },
  { value: 'LT', label: 'Litro', short: 'lt' },
  { value: 'MT', label: 'Metro', short: 'mt' },
];

interface ProductFormProps {
  product?: Product | null;
  categories: Category[];
}

export function ProductForm({ product, categories }: ProductFormProps) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.imageUrl || null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [barcodeValue, setBarcodeValue] = useState(product?.barcode || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!product;

  const [unit, setUnit] = useState<UnitValue>((product?.baseUnit as UnitValue) || 'UNIT');
  const [presentations, setPresentations] = useState<PresentationRow[]>(
    (product?.presentations ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      factor: p.factor,
      price: p.price ?? '',
      barcode: p.barcode ?? '',
      isActive: p.isActive,
    })),
  );
  const [presentationError, setPresentationError] = useState<string | null>(null);

  const addPresentation = () =>
    setPresentations((prev) => [
      ...prev,
      { name: '', factor: '1', price: '', barcode: '', isActive: true },
    ]);

  const updatePresentationRow = (
    index: number,
    field: keyof PresentationRow,
    value: string | boolean,
  ) =>
    setPresentations((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );

  const removePresentationRow = (index: number) =>
    setPresentations((prev) => prev.filter((_, i) => i !== index));

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

    const cleanPresentations = presentations
      .map((row) => ({
        id: row.id,
        name: row.name.trim(),
        factor: Number(row.factor),
        price: row.price === '' ? undefined : Number(row.price),
        barcode: row.barcode.trim() || undefined,
        isActive: row.isActive,
      }))
      .filter((row) => row.name || row.id);

    const invalidPresentation = cleanPresentations.find(
      (row) => !row.name || !Number.isFinite(row.factor) || row.factor <= 0,
    );
    if (invalidPresentation) {
      setPresentationError('Cada presentación necesita un nombre y un factor mayor a 0.');
      setLoading(false);
      return;
    }
    setPresentationError(null);

    const data = {
      name: formData.get('name') as string,
      sku: (formData.get('sku') as string) || undefined,
      barcode: (formData.get('barcode') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
      costPrice: parseFloat(formData.get('costPrice') as string) || 0,
      salePrice: parseFloat(formData.get('salePrice') as string) || 0,
      stockQuantity: parseFloat(formData.get('stockQuantity') as string) || 0,
      minStock: parseFloat(formData.get('minStock') as string) || 5,
      baseUnit: unit,
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

      const payload = isEdit
        ? data
        : {
            ...data,
            presentations: cleanPresentations.map((row) => ({
              name: row.name,
              factor: row.factor,
              price: row.price,
              barcode: row.barcode,
            })),
          };

      await apiFetch(url, {
        method,
        token: getAccessToken(),
        body: JSON.stringify(payload),
      });

      if (isEdit && product) {
        const keptIds = new Set(cleanPresentations.filter((row) => row.id).map((row) => row.id as string));

        for (const existing of product.presentations ?? []) {
          if (!keptIds.has(existing.id)) {
            await apiFetch(`/products/presentations/${existing.id}`, {
              method: 'DELETE',
              token: getAccessToken(),
            });
          }
        }

        for (const row of cleanPresentations) {
          const body = JSON.stringify({
            name: row.name,
            factor: row.factor,
            price: row.price,
            barcode: row.barcode,
            isActive: row.isActive,
          });

          if (row.id) {
            await apiFetch(`/products/presentations/${row.id}`, {
              method: 'PATCH',
              token: getAccessToken(),
              body,
            });
          } else {
            await apiFetch(`/products/${product.id}/presentations`, {
              method: 'POST',
              token: getAccessToken(),
              body,
            });
          }
        }
      }

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
    <div className="min-h-screen bg-background">
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
            <div className="relative shrink-0">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-3 shadow-lg shadow-emerald-500/20">
                <Package className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-emerald-400"></div>
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight break-words">
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
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-muted dark:to-muted/50 p-6 md:p-8 rounded-2xl border border-slate-200">
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
                        <span className={`font-bold ${Number(product?.stockQuantity ?? 0) < Number(product?.minStock ?? 5) ? 'text-red-500' : 'text-slate-900'}`}>
                          {Number(product?.stockQuantity ?? 0)} {UNIT_OPTIONS.find((o) => o.value === ((product?.baseUnit as UnitValue) || 'UNIT'))?.short}
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
            <div data-ui-card className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8">
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

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Input 
                              id="barcode" 
                              name="barcode"
                              value={barcodeValue}
                              onChange={(e) => setBarcodeValue(e.target.value)}
                              placeholder="100000000001"
                              className={`h-12 w-full rounded-xl border-slate-200 bg-slate-50/50 pl-10 pr-4 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all ${fieldErrors.barcode ? 'border-red-500' : ''}`}
                            />
                            <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                          </div>
                          <BarcodeScanner onDetected={(code) => setBarcodeValue(code)} />
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
                    <Banknote className="h-4 w-4" />
                    Precios y costos
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="baseUnit" className="text-sm font-semibold text-slate-700">Unidad de medida</Label>
                      <div className="relative">
                        <select
                          id="baseUnit"
                          name="baseUnit"
                          value={unit}
                          onChange={(event) => setUnit(event.target.value as UnitValue)}
                          className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 pr-10 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all appearance-none cursor-pointer"
                        >
                          {UNIT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label} ({option.short})
                            </option>
                          ))}
                        </select>
                        <Ruler className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 pointer-events-none" />
                      </div>
                      <p className="text-xs text-slate-400">El stock se controla en esta unidad base; las presentaciones se convierten a ella.</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stockQuantity" className="text-sm font-semibold text-slate-700">Stock inicial</Label>
                      <Input
                        id="stockQuantity"
                        name="stockQuantity"
                        type="number"
                        step="0.001"
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
                          step="0.001"
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

                {/* Presentations Section */}
                <div>
                  <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Presentaciones
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addPresentation}
                      className="h-9 rounded-xl border-slate-200 hover:bg-slate-50 hover:border-emerald-300 text-slate-600"
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Agregar
                    </Button>
                  </div>

                  <p className="text-xs text-slate-400 mb-4">
                    Define empaques (saco, caja, botella) y cuántas unidades base contiene cada uno. Ej: 1 saco = 50 kg.
                  </p>

                  {presentations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                      <Layers className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-2 text-sm text-slate-400">Sin presentaciones. Vende solo por {UNIT_OPTIONS.find((o) => o.value === unit)?.label.toLowerCase()}.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {presentations.map((row, index) => (
                        <div
                          key={row.id ?? index}
                          className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 sm:p-4"
                        >
                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-12">
                            <div className="col-span-2 sm:col-span-4 space-y-1">
                              <Label className="text-xs font-semibold text-slate-500">Nombre</Label>
                              <Input
                                value={row.name}
                                onChange={(event) => updatePresentationRow(index, 'name', event.target.value)}
                                placeholder="Saco 50 kg"
                                className="h-10 rounded-lg border-slate-200 bg-white"
                              />
                            </div>
                            <div className="col-span-1 sm:col-span-2 space-y-1">
                              <Label className="text-xs font-semibold text-slate-500">Factor</Label>
                              <Input
                                type="number"
                                step="0.001"
                                min="0"
                                value={row.factor}
                                onChange={(event) => updatePresentationRow(index, 'factor', event.target.value)}
                                placeholder="50"
                                className="h-10 rounded-lg border-slate-200 bg-white"
                              />
                            </div>
                            <div className="col-span-1 sm:col-span-2 space-y-1">
                              <Label className="text-xs font-semibold text-slate-500">Precio</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">S/</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={row.price}
                                  onChange={(event) => updatePresentationRow(index, 'price', event.target.value)}
                                  placeholder="Opcional"
                                  className="h-10 rounded-lg border-slate-200 bg-white pl-9"
                                />
                              </div>
                            </div>
                            <div className="col-span-2 sm:col-span-3 space-y-1">
                              <Label className="text-xs font-semibold text-slate-500">Código de barras</Label>
                              <Input
                                value={row.barcode}
                                onChange={(event) => updatePresentationRow(index, 'barcode', event.target.value)}
                                placeholder="Opcional"
                                className="h-10 rounded-lg border-slate-200 bg-white"
                              />
                            </div>
                            <div className="col-span-2 sm:col-span-1 flex items-end justify-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removePresentationRow(index)}
                                className="h-10 w-10 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                aria-label="Eliminar presentación"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {presentationError && (
                    <p className="mt-3 text-sm text-red-500">{presentationError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">Los campos marcados con * son obligatorios</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push('/products')} 
                className="h-12 w-full rounded-xl px-6 border-slate-200 hover:bg-slate-50 sm:w-auto"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 font-semibold hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all sm:w-auto"
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
