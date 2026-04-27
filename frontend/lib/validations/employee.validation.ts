import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  lastName: z.string().min(1, 'El apellido es requerido').max(100, 'Máximo 100 caracteres'),
  email: z.string().email('Correo electrónico inválido').min(1, 'El correo es requerido'),
  phone: z.string().min(9, 'El teléfono debe tener al menos 9 dígitos').max(15, 'Máximo 15 caracteres').optional().or(z.literal('')),
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos'),
  role: z.enum(['MANAGER', 'CASHIER', 'VIEWER']).default('CASHIER'),
  isActive: z.boolean().default(true),
});

export const updateEmployeeSchema = createEmployeeSchema.extend({
  email: z.string().email('Correo electrónico inválido').optional(),
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos').optional(),
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
