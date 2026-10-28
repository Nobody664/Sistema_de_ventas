import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { ProductsPageClient } from "./products-client";
import type { Category } from "@/types/api";
import type { ProductCatalog } from "@/types/products";

export default async function ProductsPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const canReadCategories = session?.user?.roles.some((role) =>
    ["COMPANY_ADMIN", "MANAGER"].includes(role),
  );
  const [catalog, categories] = await Promise.all([
    serverApiFetch<ProductCatalog>(
      "/products/catalog?page=1&limit=50",
      accessToken,
    ),
    canReadCategories
      ? serverApiFetch<Category[]>("/products/categories", accessToken)
      : Promise.resolve([]),
  ]);

  return (
    <ProductsPageClient
      initialCatalog={
        catalog ?? { data: [], total: 0, page: 1, limit: 50, totalPages: 0 }
      }
      categories={categories ?? []}
    />
  );
}
