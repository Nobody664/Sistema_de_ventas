import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

function makeService(categoryFinder: (args: any) => any) {
  const prisma = { category: { findFirst: categoryFinder } } as any;
  return new ProductsService(prisma, {} as any, {} as any, {} as any);
}

describe('ProductsService tenant scoping', () => {
  it('rejects creating a product with a category from another tenant', async () => {
    const calls: any[] = [];
    const svc = makeService(async (args: any) => {
      calls.push(args);
      return null;
    });

    await assert.rejects(
      () => (svc as any).ensureCategory('com-a', 'cat-unknown'),
      NotFoundException,
    );
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].where, { id: 'cat-unknown', companyId: 'com-a' });
  });

  it('allows a category that belongs to the tenant', async () => {
    const svc = makeService(async (args: any) => ({
      id: args.where.id,
      companyId: args.where.companyId,
      name: 'Categoría',
    }));

    const category = await (svc as any).ensureCategory('com-a', 'cat-a');
    assert.equal(category.id, 'cat-a');
    assert.equal(category.companyId, 'com-a');
  });
});