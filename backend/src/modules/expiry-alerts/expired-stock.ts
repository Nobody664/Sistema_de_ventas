import { Prisma } from "@prisma/client";
import {
  companyDateKey,
  companyTimeZone,
} from "@/common/helpers/company-timezone.helper";
import { expiryDateKey } from "./expiry-policy";

export interface ExpiredStockProduct {
  id: string;
  name: string;
  stockQuantity: Prisma.Decimal;
  expiryDate: Date | null;
}

export interface ExpiredStockBatch {
  id: string;
  batchNumber: string;
  quantityAvailable: Prisma.Decimal;
  expirationDate: Date | null;
}

export interface ExpiredStockItem {
  productId: string;
  productName: string;
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: string;
  quantity: number;
}

export function expiredStockItems(
  product: ExpiredStockProduct,
  batches: readonly ExpiredStockBatch[] | null | undefined,
  timeZone: string | null | undefined,
  now = new Date(),
): ExpiredStockItem[] {
  const today = companyDateKey(now, companyTimeZone(timeZone));
  const available = (batches ?? []).filter((batch) =>
    batch.quantityAvailable.gt(0),
  );
  const expired = available.flatMap((batch) => {
    const expiryDate = expiryDateKey(
      batch.expirationDate ?? product.expiryDate,
    );
    if (!expiryDate || expiryDate >= today) return [];
    return [
      {
        productId: product.id,
        productName: product.name,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate,
        quantity: Number(batch.quantityAvailable),
      },
    ];
  });
  if (expired.length > 0) return expired;

  if (
    available.length > 0 ||
    !product.stockQuantity ||
    !product.stockQuantity.gt(0)
  )
    return [];
  const expiryDate = expiryDateKey(product.expiryDate);
  if (!expiryDate || expiryDate >= today) return [];

  return [
    {
      productId: product.id,
      productName: product.name,
      batchId: null,
      batchNumber: null,
      expiryDate,
      quantity: Number(product.stockQuantity),
    },
  ];
}
