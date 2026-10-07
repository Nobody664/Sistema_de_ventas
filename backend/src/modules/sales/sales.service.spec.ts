import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SalesService } from './sales.service';

function makeSaleService() {
  const saleCreated = {
    id: 's1',
    saleNumber: 'SALE-1',
    totalAmount: 100,
    paymentMethod: 'CASH',
    customerId: null,
    employeeId: null,
    items: [],
  };
  const tx = {
    sale: { create: async () => saleCreated },
    product: { updateMany: async () => ({ count: 1 }) },
    inventoryMovement: { create: async () => ({ id: 'm1' }) },
  } as any;
  const prisma = {
    product: {
      findMany: async () => [
        { id: 'p1', stockQuantity: 10, name: 'Producto A', salePrice: 50 },
      ],
    },
    $transaction: async (cb: any) => cb(tx),
  } as any;
  const notificationsService = {} as any;
  const kardexService = { recordOutMovement: async () => undefined } as any;
  const productBatchesService = { reserveFromBatch: async () => undefined } as any;
  const auditService = { log: async () => undefined } as any;

  const svc = new SalesService(
    prisma,
    notificationsService,
    kardexService,
    productBatchesService,
    auditService,
  );
  return svc;
}

describe('SalesService.createSale', () => {
  it('creates a sale without throwing the TDZ reference error', async () => {
    const svc = makeSaleService();
    const sale = await svc.createSale('com-a', {
      items: [{ productId: 'p1', quantity: 2 }],
      paymentMethod: 'CASH',
    } as any);

    assert.equal(sale.id, 's1');
    assert.equal(sale.saleNumber, 'SALE-1');
  });

  it('rejects items from another tenant (product lookup is scoped)', async () => {
    const prisma = { product: { findMany: async () => [] } } as any;
    const svc = new SalesService(
      prisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    await assert.rejects(
      () =>
        svc.createSale('com-a', {
          items: [{ productId: 'p-other', quantity: 1 }],
          paymentMethod: 'CASH',
        } as any),
      /not found/i,
    );
  });
});