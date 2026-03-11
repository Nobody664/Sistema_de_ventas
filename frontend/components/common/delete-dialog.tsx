'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { useUiStore } from '@/store/ui-store';

interface DeleteDialogProps {
  id: string;
  entity: 'product' | 'customer' | 'employee' | 'sale' | 'category';
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

const QUERY_KEYS: Record<string, string[]> = {
  product: ['products'],
  customer: ['customers'],
  employee: ['employees'],
  sale: ['sales'],
  category: ['categories'],
};

export function DeleteDialog({ id, entity, title, description, onSuccess }: DeleteDialogProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entityNames = {
    product: 'el producto',
    customer: 'el cliente',
    employee: 'el empleado',
    sale: 'la venta',
    category: 'la categoria',
  };

  const entityLabels = {
    product: 'Producto',
    customer: 'Cliente',
    employee: 'Empleado',
    sale: 'Venta',
    category: 'Categoría',
  };

  const endpoints = {
    product: `/products/${id}`,
    customer: `/customers/${id}`,
    employee: `/employees/${id}`,
    sale: `/sales/${id}`,
    category: `/products/categories/${id}`,
  };

  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiFetch(endpoints[entity], {
        method: 'DELETE',
        token: session?.accessToken,
      });

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS[entity] });
      router.refresh();
      addToast(`${entityLabels[entity]} eliminado correctamente`, 'success');
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      addToast(err instanceof Error ? err.message : `Error al eliminar ${entityLabels[entity].toLowerCase()}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)} className="bg-red-600 hover:bg-red-700">
        Eliminar
      </Button>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title || 'Confirmar eliminacion'}</DialogTitle>
          <DialogDescription>
            {description || `Estas seguro de que deseas eliminar ${entityNames[entity]}? Esta accion no se puede deshacer.`}
          </DialogDescription>
        </DialogHeader>
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={loading} className="bg-red-600 hover:bg-red-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Eliminar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
