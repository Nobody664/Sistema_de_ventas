'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Loader2, FolderTree, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import { handleLimitError } from '@/lib/handle-limit-error';
import { useUiStore } from '@/store/ui-store';
import { createCategorySchema } from '@/lib/validations/category.validation';
import type { Category } from '@/types/api';

interface CategoryFormProps {
  category?: Category | null;
}

export function CategoryForm({ category }: CategoryFormProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const addToast = useUiStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isEdit = !!category;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(e.currentTarget);
    
    const data = {
      name: formData.get('name') as string,
      description: (formData.get('description') as string) || undefined,
    };

    const result = createCategorySchema.safeParse(data);

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
      const url = isEdit ? `/products/categories/${category.id}` : '/products/categories';
      const method = isEdit ? 'PATCH' : 'POST';

      await apiFetch(url, {
        method,
        token: session?.accessToken,
        body: JSON.stringify(data),
      });

      queryClient.invalidateQueries({ queryKey: ['categories'] });
      addToast(isEdit ? 'Categoría actualizada correctamente' : 'Categoría creada correctamente', 'success');
      await router.replace('/categories');
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
      <div className="mx-auto max-w-2xl px-5 py-8 md:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/categories')}
            className="mb-4 flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a categorías
          </button>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 shadow-lg shadow-amber-500/20">
                <FolderTree className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-amber-400"></div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {isEdit ? 'Editar categoría' : 'Nueva categoría'}
              </h1>
              <p className="text-sm text-slate-500 font-medium">
                {isEdit ? 'Actualiza la información de la categoría' : 'Completa los datos para crear una nueva categoría'}
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

          <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold text-slate-700">
                  Nombre de la categoría *
                </Label>
                <Input 
                  id="name" 
                  name="name"
                  defaultValue={category?.name || ''}
                  placeholder="Ej: Bebidas"
                  className={`h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all ${fieldErrors.name ? 'border-red-500' : ''}`}
                />
                {fieldErrors.name && (
                  <p className="text-sm text-red-500">{fieldErrors.name}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-semibold text-slate-700">
                  Descripción
                </Label>
                <textarea
                  id="description" 
                  name="description"
                  defaultValue={category?.description || ''}
                  placeholder="Descripción de la categoría..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Los campos marcados con * son obligatorios</p>
            <div className="flex items-center gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push('/categories')} 
                className="h-12 rounded-xl px-6 border-slate-200 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 font-semibold hover:from-amber-600 hover:to-orange-700 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Guardar cambios' : 'Crear categoría'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
