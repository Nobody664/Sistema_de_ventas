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
import type { Category } from '@/types/api';

interface CategoryModalProps {
  category?: Category | null;
  children?: React.ReactNode;
}

export function CategoryModal({ category, children }: CategoryModalProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!category;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') || null,
    };

    try {
      const url = isEdit ? `/products/categories/${category.id}` : '/products/categories';
      const method = isEdit ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['categories'] });
      router.refresh();
      addToast(isEdit ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente', 'success');
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      addToast(err instanceof Error ? err.message : 'Error al guardar categoría', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar categoria' : 'Nueva categoria'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Actualiza los datos de la categoria' : 'Completa los datos para crear una nueva categoria'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input id="name" name="name" required defaultValue={category?.name} placeholder="Electronica" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripcion</Label>
              <Input id="description" name="description" defaultValue={category?.description || ''} placeholder="Descripcion de la categoria" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Guardar cambios' : 'Crear categoria'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
