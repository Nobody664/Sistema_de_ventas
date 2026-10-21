import { z } from "zod";
import { isValidPeruPhone, isValidRuc } from "./pe-document";

export const createCustomerSchema = z
  .object({
    firstName: z
      .string()
      .min(1, "El nombre es requerido")
      .max(100, "Máximo 100 caracteres"),
    lastName: z
      .string()
      .min(1, "El apellido es requerido")
      .max(100, "Máximo 100 caracteres"),
    email: z
      .string()
      .email("Correo electrónico inválido")
      .optional()
      .or(z.literal("")),
    phone: z
      .string()
      .refine((value) => value === "" || isValidPeruPhone(value), {
        message: "El teléfono debe tener entre 9 y 12 dígitos",
      })
      .optional()
      .or(z.literal("")),
    documentType: z.enum(["DNI", "RUC", "PASSPORT"]).default("DNI"),
    documentNumber: z.string().min(1, "El número de documento es requerido"),
    notes: z
      .string()
      .max(500, "Máximo 500 caracteres")
      .optional()
      .or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const docType = data.documentType;
    const docNum = data.documentNumber;

    if (docType === "DNI" && docNum.length !== 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El DNI debe tener exactamente 8 dígitos",
        path: ["documentNumber"],
      });
    }
    if (docType === "RUC" && docNum.length !== 11) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El RUC debe tener exactamente 11 dígitos",
        path: ["documentNumber"],
      });
    }
    if (docType === "RUC" && docNum.length === 11 && !isValidRuc(docNum)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El RUC ingresado no es válido",
        path: ["documentNumber"],
      });
    }
    if (docType === "PASSPORT" && (docNum.length < 6 || docNum.length > 20)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El pasaporte debe tener entre 6 y 20 caracteres",
        path: ["documentNumber"],
      });
    }
  });

export const updateCustomerSchema = createCustomerSchema;

export type CreateCustomerDto = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerDto = z.infer<typeof updateCustomerSchema>;
