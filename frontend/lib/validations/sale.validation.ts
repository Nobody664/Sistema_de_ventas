import { z } from 'zod';

export const createSaleSchema = z.object({
  customerId: z.string().optional().or(z.literal('')),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER']).default('CASH'),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().min(1, 'La cantidad debe ser al menos 1'),
  })).min(1, 'Debe agregar al menos un producto'),
  discountPercent: z.number().min(0).max(100).default(0),
  notes: z.string().optional().or(z.literal('')),
});

export type CreateSaleDto = z.infer<typeof createSaleSchema>;
