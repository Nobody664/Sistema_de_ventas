import { z } from "zod";

const optionalSalary = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined ? null : value,
  z.coerce
    .number({ error: "Monto inválido" })
    .min(0, "No puede ser negativo")
    .nullable(),
);

const optionalPaymentDay = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined ? null : value,
  z.coerce
    .number({ error: "Día inválido" })
    .int("Debe ser un número entero")
    .min(1, "Debe estar entre 1 y 31")
    .max(31, "Entre 1 y 31")
    .nullable(),
);

export const createEmployeeSchema = z
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
      .min(1, "El correo es requerido"),
    phone: z
      .string()
      .min(9, "El teléfono debe tener al menos 9 dígitos")
      .max(15, "Máximo 15 caracteres")
      .optional()
      .or(z.literal("")),
    dni: z.string().regex(/^\d{8}$/, "El DNI debe tener exactamente 8 dígitos"),
    salary: optionalSalary.optional(),
    paymentDay: optionalPaymentDay.optional(),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .max(100, "Máximo 100 caracteres")
      .optional()
      .or(z.literal("")),
    confirmPassword: z.string().optional().or(z.literal("")),
    role: z
      .enum(["COMPANY_ADMIN", "MANAGER", "CASHIER", "VIEWER"])
      .default("CASHIER"),
    isActive: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.password && data.password !== data.confirmPassword) {
        return false;
      }
      return true;
    },
    {
      message: "Las contraseñas no coinciden",
      path: ["confirmPassword"],
    },
  );

export const updateEmployeeSchema = z.object({
  firstName: z
    .string()
    .min(1, "El nombre es requerido")
    .max(100, "Máximo 100 caracteres")
    .optional(),
  lastName: z
    .string()
    .min(1, "El apellido es requerido")
    .max(100, "Máximo 100 caracteres")
    .optional(),
  email: z.string().email("Correo electrónico inválido").optional(),
  phone: z
    .string()
    .min(9, "El teléfono debe tener al menos 9 dígitos")
    .max(15, "Máximo 15 caracteres")
    .optional()
    .or(z.literal("")),
  dni: z
    .string()
    .regex(/^\d{8}$/, "El DNI debe tener exactamente 8 dígitos")
    .optional(),
  salary: optionalSalary.optional(),
  paymentDay: optionalPaymentDay.optional(),
  role: z.enum(["COMPANY_ADMIN", "MANAGER", "CASHIER", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
