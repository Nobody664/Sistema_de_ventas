export interface StoreCart {
  version: number;
  items: {
    productId: string;
    presentationId: string | null;
    name: string;
    quantity: string;
    unitPrice: string;
    presentationName: string | null;
    baseUnit?: string;
    imageUrl?: string | null;
    unavailable: boolean;
  }[];
}

export function storeQuantity(value: string | number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 3 }).format(
    Number(value),
  );
}

export function cartQuantity(cart: StoreCart | null): number {
  return (
    (cart?.items.reduce(
      (total, item) => total + Math.round(Number(item.quantity) * 1000),
      0,
    ) ?? 0) / 1000
  );
}

export function addStoreQuantity(
  current: string | number,
  amount: number,
): number {
  return (
    (Math.round(Number(current) * 1000) + Math.round(amount * 1000)) / 1000
  );
}
