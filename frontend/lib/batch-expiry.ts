export interface ExpiryBatch {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    baseUnit: string;
    isActive: boolean;
  };
  branchName: string | null;
  batchNumber: string;
  expirationDate: string;
  expiryInherited?: boolean;
  daysLeft: number;
  quantityReceived: string;
  quantityAvailable: string;
  reservedQuantity: string;
  purchasePrice: string;
  lossAmount: string;
  updatedAt: string;
}

export interface ExpiryBatchList {
  today: string;
  lastDay: string;
  timezone: string;
  currency: string;
  page: number;
  total: number;
  totalPages: number;
  counts: { expired: number; expiring: number };
  data: ExpiryBatch[];
}

export interface BatchWriteOffResult {
  batchId: string;
  batchNumber: string;
  productId: string;
  quantity: string;
  remainingStock: string;
  lossAmount: string;
  currency: string;
  financeRecordId: string;
  movementId: string;
}

export function batchStateLabel(daysLeft: number): string {
  return daysLeft < 0
    ? "Vencido"
    : daysLeft === 0
      ? "Vence hoy"
      : `Vence en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`;
}

export function batchDateLabel(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
