import { BadRequestException } from "@nestjs/common";
import { isISO8601 } from "class-validator";

export function rejectNullFields(
  input: object,
  fields: readonly string[],
): void {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new BadRequestException("Se requiere un objeto de campos");
  const values = input as Record<string, unknown>;
  for (const field of fields)
    if (values[field] === null)
      throw new BadRequestException(
        `${field} no admite null; omite el campo para conservarlo`,
      );
}

export function optionalDate(value: unknown, nullable: false): Date | undefined;
export function optionalDate(
  value: unknown,
  nullable?: true,
): Date | null | undefined;
export function optionalDate(
  value: unknown,
  nullable = true,
): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null && nullable) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime()))
    return new Date(value);
  if (
    typeof value !== "string" ||
    !isISO8601(value, { strict: true, strictSeparator: true }) ||
    Number.isNaN(new Date(value).getTime())
  )
    throw new BadRequestException("Fecha ISO inválida");
  return new Date(value);
}
