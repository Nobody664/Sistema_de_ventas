import { auth } from '@/auth';
import { Card } from '@/components/ui/card';
import { serverApiFetch } from '@/lib/server-api';
import { Package, AlertTriangle, TrendingUp } from 'lucide-react';
import { ProductActions, NewProductButton } from '@/components/products/product-actions';
import type { Product, Category } from '@/types/api';

export default async function ProductsPage() {
  const session = await auth();
  const accessToken = session?.accessToken;

  const [products, categories] = await Promise.all([
    serverApiFetch<Product[]>('/products', accessToken),
    serverApiFetch<Category[]>('/products/categories', accessToken),
  ]);

  const lowStockProducts = products?.filter((p) => p.stockQuantity <= (p.minStock ?? 10)) ?? [];
  const totalValue = products?.reduce((acc, p) => acc + Number(p.salePrice) * p.stockQuantity, 0) ?? 0;

  return (
    <div className="space-y-6">
      <Card className="rounded-[34px] bg-gradient-to-br from-emerald-500 to-teal-700 p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-white/60">Catalogo de productos</p>
            <h1 className="mt-4 font-display text-5xl leading-none">Gestion de inventario</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Administra tu catalogo de productos, controla el stock y mantien actualizado tu inventario.
            </p>
          </div>
          <NewProductButton categories={categories ?? []} />
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="rounded-[30px] bg-white/80 p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-500/20 p-2">
              <Package className="size-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Total productos</p>
              <p className="font-display text-3xl">{products?.length ?? 0}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-[30px] bg-white/80 p-6">
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

        <Card className="rounded-[30px] bg-white/80 p-6">
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

      <Card className="rounded-[34px] bg-white/85 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-foreground/50">Productos</p>
            <h2 className="mt-2 font-display text-2xl">Lista completa</h2>
          </div>
          <div className="flex gap-2">
            <select className="rounded-xl border border-foreground/10 px-4 py-2 text-sm">
              <option>Todas las categorias</option>
              {categories?.map((cat) => (
                <option key={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/10 text-left text-sm text-foreground/50">
                <th className="pb-4 font-medium">Producto</th>
                <th className="pb-4 font-medium">SKU</th>
                <th className="pb-4 font-medium">Categoria</th>
                <th className="pb-4 font-medium text-right">Stock</th>
                <th className="pb-4 font-medium">Precio</th>
                <th className="pb-4 font-medium text-right">Estado</th>
                <th className="pb-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(products?.length ?? 0) > 0 ? (
                products?.map((product) => (
                  <tr
                    key={product.id}
                    className="border-b border-foreground/5 transition hover:bg-foreground/[0.02]"
                  >
                    <td className="py-4">
                      <p className="font-medium">{product.name}</p>
                    </td>
                    <td className="py-4 text-foreground/60">{product.sku}</td>
                    <td className="py-4 text-foreground/60">{product.category?.name ?? '-'}</td>
                    <td className="py-4 text-right">
                      <span
                        className={`font-medium ${
                          product.stockQuantity <= (product.minStock ?? 10)
                            ? 'text-amber-600'
                            : 'text-foreground'
                        }`}
                      >
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td className="py-4 text-right">S/ {product.salePrice}</td>
                    <td className="py-4 text-right">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs ${
                          product.status === 'ACTIVE'
                            ? 'border-green-500/30 bg-green-500/20 text-green-700'
                            : 'border-gray-500/30 bg-gray-500/20 text-gray-600'
                        }`}
                      >
                        {product.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      <ProductActions product={product} categories={categories ?? []} />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-foreground/50">
                    No hay productos registrados. Corre el seed para ver datos de ejemplo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
