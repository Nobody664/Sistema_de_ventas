import { serverApiFetch } from "@/lib/server-api";
import { getServerSession } from "@/lib/session";
import { StockEntriesClient } from "./entries-client";

export interface StockEntryProductOption {
  id: string;
  name: string;
  sku: string | null;
  baseUnit: string;
  stockQuantity: string;
  presentations: Array<{
    id: string;
    name: string;
    factor: string;
    price: string | null;
  }>;
}

export interface StockEntryDistributorOption {
  id: string;
  name: string;
  code: string;
}

export interface DistributorPurchaseSummary {
  distributor: { id: string; name: string; code: string } | null;
  entryCount: number;
  itemCount: number;
  totalPurchased: number;
  pendingCount: number;
  pendingTotal: number;
  lastEntryDate: string | null;
  entries: Array<{
    id: string;
    reference: string | null;
    entryDate: string;
    itemCount: number;
    total: number;
    receiptId: string | null;
  }>;
}

export interface PurchaseReceiptRecord {
  id: string;
  series: string;
  number: number;
  fullNumber: string;
  issuedAt: string;
  totalAmount: number;
  entryCount: number;
  itemCount: number;
  distributor: { id: string; name: string; code: string } | null;
}

export interface PurchaseReceiptDetail extends PurchaseReceiptRecord {
  entries: Array<{
    id: string;
    reference: string | null;
    entryDate: string;
    items: Array<{
      id: string;
      quantity: string;
      baseQuantity: string;
      unitCost: string;
      product: {
        id: string;
        name: string;
        sku: string | null;
        baseUnit: string;
      };
      presentation: { id: string; name: string; factor: string } | null;
    }>;
  }>;
}

export default async function StockEntriesPage() {
  const session = await getServerSession();
  const accessToken = session?.accessToken;

  const [entries, products, branches, distributors, purchases, receipts] =
    await Promise.all([
      serverApiFetch<Array<Record<string, unknown>>>(
        "/stock-entries",
        accessToken,
      ),
      serverApiFetch<StockEntryProductOption[]>("/products", accessToken),
      serverApiFetch<Array<{ id: string; name: string }>>(
        "/branches",
        accessToken,
      ),
      serverApiFetch<StockEntryDistributorOption[]>(
        "/distributors",
        accessToken,
      ),
      serverApiFetch<DistributorPurchaseSummary[]>(
        "/stock-entries/purchases/by-distributor",
        accessToken,
      ),
      serverApiFetch<PurchaseReceiptRecord[]>(
        "/stock-entries/receipts",
        accessToken,
      ),
    ]);

  return (
    <StockEntriesClient
      initialEntries={entries ?? []}
      products={products ?? []}
      branches={branches ?? []}
      distributors={distributors ?? []}
      purchases={purchases ?? []}
      receipts={receipts ?? []}
    />
  );
}
