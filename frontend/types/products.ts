import type { Product } from "./api";

export interface ProductCatalog {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
