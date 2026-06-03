import { z } from 'zod';

export const createEmployeeSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  lastName: z.string().min(1, 'El apellido es requerido').max(100, 'Máximo 100 caracteres'),
  email: z.string().email('Correo electrónico inválido').min(1, 'El correo es requerido'),
  phone: z.string().min(9, 'El teléfono debe tener al menos 9 dígitos').max(15, 'Máximo 15 caracteres').optional().or(z.literal('')),
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100, 'Máximo 100 caracteres').optional().or(z.literal('')),
  confirmPassword: z.string().optional().or(z.literal('')),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER']).default('CASHIER'),
  isActive: z.boolean().default(true),
}).refine((data) => {
  if (data.password && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export const updateEmployeeSchema = z.object({
  firstName: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres').optional(),
  lastName: z.string().min(1, 'El apellido es requerido').max(100, 'Máximo 100 caracteres').optional(),
  email: z.string().email('Correo electrónico inválido').optional(),
  phone: z.string().min(9, 'El teléfono debe tener al menos 9 dígitos').max(15, 'Máximo 15 caracteres').optional().or(z.literal('')),
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener exactamente 8 dígitos').optional(),
  role: z.enum(['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER']).optional(),
  isActive: z.boolean().optional(),
});

export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
