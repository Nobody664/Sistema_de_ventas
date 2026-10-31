import { BadRequestException } from "@nestjs/common";

export const EXPORT_BATCH_SIZE = 500;

export async function collectExportRows<T extends { id: string }>(
  fetch: (take: number, after?: string) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  let after: string | undefined;
  while (true) {
    const batch = await fetch(EXPORT_BATCH_SIZE, after);
    rows.push(...batch);
    if (rows.length > 10000)
      throw new BadRequestException(
        "La exportación supera 10000 filas; reduce el conjunto antes de exportar",
      );
    if (batch.length < EXPORT_BATCH_SIZE) return rows;
    const next = batch[batch.length - 1].id;
    if (next === after) throw new Error("EXPORT_CURSOR_DID_NOT_ADVANCE");
    after = next;
  }
}
