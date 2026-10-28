export interface PurchaseOrderDraftItem {
  productId: string;
  name: string;
  baseUnit: string;
  quantity: string;
  unitCost: string;
}

export function purchaseDecimal(
  value: string,
  places: number,
  minimum: number,
  maximum: number,
  label: string,
): number {
  const normalized = value.trim().replace(",", ".");
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(normalized))
    throw new Error(`${label}: usa un número con hasta ${places} decimales`);
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < minimum || number > maximum)
    throw new Error(`${label}: valor fuera del rango permitido`);
  return number;
}

export function purchaseOrderPayload(
  supplierId: string,
  reference: string,
  notes: string,
  rows: PurchaseOrderDraftItem[],
) {
  if (!supplierId) throw new Error("Selecciona un proveedor");
  if (!rows.length || rows.length > 100)
    throw new Error("La orden requiere entre 1 y 100 productos");
  if (new Set(rows.map((row) => row.productId)).size !== rows.length)
    throw new Error("Hay productos duplicados en la orden");
  if (reference.trim().length > 60 || notes.trim().length > 500)
    throw new Error("La referencia o las notas exceden el largo permitido");
  return {
    supplierId,
    reference: reference.trim() || undefined,
    notes: notes.trim() || undefined,
    items: rows.map((row) => {
      const quantity = purchaseDecimal(
        row.quantity,
        3,
        0.001,
        99999999999.999,
        `Cantidad de ${row.name}`,
      );
      if (
        !["KG", "LT", "MT"].includes(row.baseUnit) &&
        !Number.isInteger(quantity)
      )
        throw new Error(`La cantidad de ${row.name} debe ser entera`);
      return {
        productId: row.productId,
        requestedQuantity: quantity,
        unitCost:
          row.unitCost.trim() === ""
            ? undefined
            : purchaseDecimal(
                row.unitCost,
                4,
                0,
                99999999.9999,
                `Costo de ${row.name}`,
              ),
      };
    }),
  };
}
