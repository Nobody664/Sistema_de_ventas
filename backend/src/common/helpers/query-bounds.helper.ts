import { BadRequestException } from "@nestjs/common";
import { optionalDate } from "./patch-contract.helper";

export function pagination(
  page: unknown = 1,
  limit: unknown = 20,
): { page: number; limit: number; skip: number } {
  if (
    typeof page !== "number" ||
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > 1000000 ||
    typeof limit !== "number" ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw new BadRequestException(
      "Paginación inválida: page 1–1000000 y limit 1–100",
    );
  return { page, limit, skip: (page - 1) * limit };
}

export function dateRange(
  from?: string,
  to?: string,
  defaultDays?: number,
): { from?: Date; to?: Date } {
  let start = optionalDate(from, false);
  let end = optionalDate(to, false);
  if (typeof from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(from))
    start!.setUTCHours(0, 0, 0, 0);
  if (typeof to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(to))
    end!.setUTCHours(23, 59, 59, 999);
  if (defaultDays) {
    if (!end) {
      end = new Date();
      end.setUTCHours(23, 59, 59, 999);
    }
    if (!start) {
      start = new Date(end.getTime() - (defaultDays - 1) * 86400000);
      start.setUTCHours(0, 0, 0, 0);
    }
  }
  if (
    start &&
    end &&
    (start > end || end.getTime() - start.getTime() > 366 * 86400000)
  )
    throw new BadRequestException(
      "El rango debe estar ordenado y no superar 366 días",
    );
  return { from: start, to: end };
}
