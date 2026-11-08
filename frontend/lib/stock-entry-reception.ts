export interface StockEntryLine {
  key: string;
  productId: string;
  presentationId: string;
  quantity: string;
  unitCost: string;
  expiryDate: string;
  batchNumber: string;
}

export interface ReceptionProduct {
  id: string;
  name: string;
  costPrice: string | null;
  presentations: { id: string; name: string; factor: string }[];
}

export function emptyStockEntryLine(): StockEntryLine {
  return {
    key: "",
    productId: "",
    presentationId: "",
    quantity: "",
    unitCost: "",
    expiryDate: "",
    batchNumber: "",
  };
}

export function receptionReferenceCost(
  product: ReceptionProduct | undefined,
  presentationId = "",
): string {
  if (!product || product.costPrice === null || product.costPrice === "")
    return "";
  const factor = Number(
    product.presentations.find(
      (presentation) => presentation.id === presentationId,
    )?.factor ?? 1,
  );
  const cost = Number(product.costPrice) * factor;
  return Number.isFinite(cost) && cost >= 0
    ? String(Number(cost.toFixed(4)))
    : "";
}

function fitsDecimals(value: number, precision: number): boolean {
  return (
    Math.abs(value - Number(value.toFixed(precision))) <=
    Number.EPSILON * Math.max(1, Math.abs(value))
  );
}

export function stockEntryLineError(
  line: StockEntryLine,
  product: ReceptionProduct | undefined,
): string | null {
  if (!product) return "Selecciona un producto disponible.";
  const presentation = product.presentations.find(
    (item) => item.id === line.presentationId,
  );
  if (line.presentationId && !presentation)
    return "Selecciona una presentación válida.";
  const quantity = Number(line.quantity);
  if (
    !line.quantity.trim() ||
    !Number.isFinite(quantity) ||
    quantity < 0.001 ||
    !fitsDecimals(quantity, 3)
  )
    return "Indica una cantidad mayor a 0, con hasta 3 decimales.";
  const baseQuantity = quantity * Number(presentation?.factor ?? 1);
  if (
    !Number.isFinite(baseQuantity) ||
    baseQuantity <= 0 ||
    !fitsDecimals(baseQuantity, 3)
  )
    return "La cantidad base debe ser representable con hasta 3 decimales.";
  const cost = Number(line.unitCost);
  if (
    !line.unitCost.trim() ||
    !Number.isFinite(cost) ||
    cost < 0 ||
    !fitsDecimals(cost, 4)
  )
    return "Indica el costo unitario con hasta 4 decimales; usa 0 si corresponde.";
  if (line.batchNumber.trim().length > 80)
    return "El lote admite hasta 80 caracteres.";
  if (line.expiryDate) {
    const date = new Date(`${line.expiryDate}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(line.expiryDate) ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== line.expiryDate
    )
      return "Indica una fecha de vencimiento válida.";
  }
  return null;
}
