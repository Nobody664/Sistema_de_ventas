'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Package, AlertTriangle, TrendingUp, Search, Download } from 'lucide-react';
import { ProductActions, NewProductButton } from '@/components/products/product-actions';
import { ImageLightbox } from '@/components/products/image-lightbox';
import { apiFetch } from '@/lib/api';
import { useSession } from 'next-auth/react';
import type { Product, Category } from '@/types/api';

interface ProductsPageClientProps {
  initialProducts: Product[];
  categories: Category[];
}

export function ProductsPageClient({ initialProducts, categories }: ProductsPageClientProps) {
  const { data: session } = useSession();
  const [products] = useState(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  const lowStockProducts = products.filter((p) => p.stockQuantity <= (p.minStock ?? 10));
  const totalValue = products.reduce((acc, p) => acc + Number(p.salePrice) * p.stockQuantity, 0);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      searchQuery === '' ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === '' || product.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleExport = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams({ format });
      if (selectedCategory) params.append('categoryId', selectedCategory);

      const response = await apiFetch<{ data: string; contentType: string; filename: string }>(`/products/export?${params}`, {
        token: session?.accessToken,
      });

      if (response?.data) {
        const link = document.createElement('a');
        link.href = `data:${response.contentType};base64,${response.data}`;
        link.download = response.filename;
        link.click();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-700 p-8 text-white animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-white/60">Catalogo de productos</p>
              <h1 className="mt-4 font-display text-5xl leading-none">Gestion de inventario</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
                Administra tu catalogo de productos, controla el stock y mantien actualizado tu inventario.
              </p>
            </div>
            <div className="hidden lg:block animate-fade-in-up delay-200">
              <NewProductButton />
            </div>
          </div>
        </Card>

        <div className="grid gap-5 md:grid-cols-3">
          <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-100">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-blue-500/20 p-2">
                <Package className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total productos</p>
                <p className="font-display text-3xl">{products.length}</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-150">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-amber-500/20 p-2">
                <AlertTriangle className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Stock bajo</p>
                <p className="font-display text-3xl">{lowStockProducts.length}</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-[30px] bg-white/80 p-6 card-hover animate-fade-in-up delay-200">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/20 p-2">
                <TrendingUp className="size-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Valor inventario</p>
                <p className="font-display text-3xl">S/ {totalValue.toFixed(2)}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="rounded-[34px] bg-white/85 p-6 animate-fade-in-up delay-250">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Productos</p>
              <h2 className="mt-2 font-display text-2xl">Lista completa</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/30" />
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-xl border border-foreground/10 bg-white py-2 pl-9 pr-4 text-sm transition focus:border-emerald-500/50 focus:outline-none"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-xl border border-foreground/10 bg-white px-4 py-2 text-sm transition focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="">Todas las categorias</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <div className="relative group">
                <button className="flex items-center gap-2 rounded-xl border border-foreground/10 bg-white px-4 py-2 text-sm transition hover:bg-foreground/5">
                  <Download className="size-4" />
                  Exportar
                </button>
                <div className="absolute right-0 top-full z-10 mt-1 hidden min-w-[140px] rounded-xl border border-foreground/10 bg-white py-1 shadow-lg group-hover:block">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5"
                  >
                    CSV
                  </button>
                  <button
                    onClick={() => handleExport('excel')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5"
                  >
                    Excel
                  </button>
                  <button
                    onClick={() => handleExport('pdf')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-foreground/5"
                  >
                    PDF
                  </button>
                </div>
              </div>
              <div className="lg:hidden">
                <NewProductButton />
              </div>
            </div>
          </div>

          <div className="overflow-auto max-h-[600px] rounded-xl border border-foreground/10">
            <table className="w-full min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                  <th className="pb-4 pl-4 font-medium">Imagen</th>
                  <th className="pb-4 font-medium">Producto</th>
                  <th className="pb-4 font-medium">SKU</th>
                  <th className="pb-4 font-medium">Categoria</th>
                  <th className="pb-4 font-medium text-right">Stock</th>
                  <th className="pb-4 font-medium text-right">Precio</th>
                  <th className="pb-4 font-medium text-center">Estado</th>
                  <th className="pb-4 pr-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((product, index) => (
                    <tr
                      key={product.id}
                      className="border-b border-foreground/5 table-row-hover animate-fade-in-up"
                      style={{ animationDelay: `${index * 30}ms`, opacity: 0 }}
                    >
                      <td className="py-4 pl-4">
                        {product.imageUrl ? (
                          <button
                            onClick={() => setLightboxImage({ src: product.imageUrl!, alt: product.name })}
                            className="group relative block overflow-hidden rounded-lg"
                          >
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-12 w-12 rounded-lg object-cover img-zoom"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                              <span className="opacity-0 transition-opacity group-hover:opacity-100 text-white text-xs">
                                Ver
                              </span>
                            </div>
                          </button>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-foreground/5">
                            <Package className="size-5 text-foreground/30" />
                          </div>
                        )}
                      </td>
                      <td className="py-4">
                        <p className="font-medium">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-foreground/40 truncate max-w-[200px]">
                            {product.description}
                          </p>
                        )}
                      </td>
                      <td className="py-4">
                        <span className="font-mono text-sm text-foreground/60">{product.sku}</span>
                      </td>
                      <td className="py-4">
                        {product.category ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            {product.category.name}
                          </span>
                        ) : (
                          <span className="text-foreground/40">-</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <span
                          className={`inline-block font-medium ${
                            product.stockQuantity <= (product.minStock ?? 10)
                              ? 'text-amber-600'
                              : product.stockQuantity === 0
                              ? 'text-red-600'
                              : 'text-foreground'
                          }`}
                        >
                          {product.stockQuantity}
                        </span>
                        {product.stockQuantity <= (product.minStock ?? 10) && (
                          <AlertTriangle className="ml-1 inline-block size-3 text-amber-500" />
                        )}
                      </td>
                      <td className="py-4 text-right">
                        <span className="font-medium">S/ {Number(product.salePrice).toFixed(2)}</span>
                      </td>
                      <td className="py-4 text-center">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                            product.status === 'ACTIVE'
                              ? 'border-green-500/30 bg-green-500/20 text-green-700'
                              : 'border-gray-500/30 bg-gray-500/20 text-gray-600'
                          }`}
                        >
                          {product.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <ProductActions product={product} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-foreground/50">
                      {searchQuery || selectedCategory
                        ? 'No se encontraron productos con los filtros aplicados.'
                        : 'No hay productos registrados. Registra el Primero!!.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredProducts.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-4">
              <p className="text-sm text-foreground/50">
                Mostrando {filteredProducts.length} de {products.length} productos
              </p>
            </div>
          )}
        </Card>
      </div>

      <ImageLightbox
        src={lightboxImage?.src || ''}
        alt={lightboxImage?.alt || ''}
        isOpen={!!lightboxImage}
        onClose={() => setLightboxImage(null)}
      />
    </>
  );
}
