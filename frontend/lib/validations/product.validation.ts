import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100, 'Máximo 100 caracteres'),
  sku: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  barcode: z.string().max(50, 'Máximo 50 caracteres').optional().or(z.literal('')),
  description: z.string().max(500, 'Máximo 500 caracteres').optional().or(z.literal('')),
  costPrice: z.coerce.number({ invalid_type_error: 'Ingrese un número válido' }).min(0, 'El precio debe ser positivo o cero'),
  salePrice: z.coerce.number({ invalid_type_error: 'Ingrese un número válido' }).min(0, 'El precio debe ser positivo o cero'),
  stockQuantity: z.coerce.number({ invalid_type_error: 'Ingrese un número válido' }).int().min(0, 'El stock no puede ser negativo'),
  minStock: z.coerce.number({ invalid_type_error: 'Ingrese un número válido' }).int().min(0, 'El stock mínimo no puede ser negativo'),
  categoryId: z.string().optional().or(z.literal('')),
  imageUrl: z.string().optional().or(z.literal('')),
});

export const updateProductSchema = createProductSchema.extend({});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
