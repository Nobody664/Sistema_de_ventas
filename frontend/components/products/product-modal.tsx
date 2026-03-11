'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

  const isEdit = !!product;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      sku: formData.get('sku') || undefined,
      barcode: formData.get('barcode') || null,
      description: formData.get('description') || null,
      costPrice: formData.get('costPrice'),
      salePrice: formData.get('salePrice'),
      stockQuantity: parseInt(formData.get('stockQuantity') as string) || 0,
      minStock: parseInt(formData.get('minStock') as string) || 5,
      categoryId: formData.get('categoryId') || null,
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Actualiza los datos del producto' : 'Completa los datos para crear un nuevo producto'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" name="name" required defaultValue={product?.name} placeholder="Cafe Premium" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU *</Label>
                <Input id="sku" name="sku" required defaultValue={product?.sku} placeholder="ACM-CAFE-001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="barcode">Codigo de barras</Label>
                <Input id="barcode" name="barcode" defaultValue={product?.barcode || ''} placeholder="100000000001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria</Label>
                <select
                  id="categoryId"
                  name="categoryId"
                  defaultValue={product?.categoryId || ''}
                  className="flex h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm"
                >
                  <option value="">Sin categoria</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripcion</Label>
              <Input id="description" name="description" defaultValue={product?.description || ''} placeholder="Descripcion del producto" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice">Precio costo *</Label>
                <Input id="costPrice" name="costPrice" type="number" step="0.01" required defaultValue={product?.costPrice} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Precio venta *</Label>
                <Input id="salePrice" name="salePrice" type="number" step="0.01" required defaultValue={product?.salePrice} placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stockQuantity">Stock inicial</Label>
                <Input id="stockQuantity" name="stockQuantity" type="number" defaultValue={product?.stockQuantity || 0} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Stock minimo</Label>
                <Input id="minStock" name="minStock" type="number" defaultValue={product?.minStock || 5} placeholder="5" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear producto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
