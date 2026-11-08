export const storeInput = "store-input w-full";
export const storeButton =
  "store-button inline-flex items-center justify-center gap-2";
export const storeMoney = (amount: string | number, currency = "PEN") =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(
    Number(amount),
  );
