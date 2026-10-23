import { z } from "zod";

export const FINANCE_DIRECTIONS = ["ENTRY", "EXIT"] as const;
export const FINANCE_EXPENSE_CATEGORIES = [
  "PAYROLL",
  "ELECTRICITY",
  "WATER",
  "MAINTENANCE",
  "OTHER",
] as const;

export const createFinanceRecordSchema = z
  .object({
    direction: z.enum(FINANCE_DIRECTIONS, {
      required_error: "Selecciona si es entrada o salida",
      invalid_type_error: "Selecciona si es entrada o salida",
    }),
    category: z.string().optional().or(z.literal("")),
    description: z
      .string()
      .trim()
      .min(3, "Mínimo 3 caracteres")
      .max(255, "Máximo 255 caracteres"),
    amount: z.coerce
      .number({ invalid_type_error: "Ingresa un monto válido" })
      .positive("Debe ser mayor a 0"),
    recordDate: z.string().min(1, "Selecciona la fecha"),
    dueDate: z.string().optional().or(z.literal("")),
    reference: z
      .string()
      .trim()
      .max(64, "Máximo 64 caracteres")
      .optional()
      .or(z.literal("")),
    supplier: z
      .string()
      .trim()
      .max(160, "Máximo 160 caracteres")
      .optional()
      .or(z.literal("")),
    employeeId: z.string().optional().or(z.literal("")),
    notes: z
      .string()
      .trim()
      .max(500, "Máximo 500 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.direction === "EXIT" && !data.category) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["category"],
        message: "Selecciona el tipo de gasto",
      });
    }
    if (
      data.direction === "EXIT" &&
      data.category === "PAYROLL" &&
      !data.employeeId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["employeeId"],
        message: "Selecciona el empleado a pagar",
      });
    }
    if (data.dueDate && data.recordDate && data.dueDate < data.recordDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dueDate"],
        message: "El vencimiento no puede ser anterior a la fecha",
      });
    }
  });

export type CreateFinanceRecordInput = z.infer<
  typeof createFinanceRecordSchema
>;
