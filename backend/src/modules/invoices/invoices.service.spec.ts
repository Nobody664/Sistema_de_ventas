import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';

const TEMPLATE = {
  id: 'tpl-1',
  paperSize: 'a4',
  type: 'FACTURA',
  name: 'Plantilla',
  companyRuc: '20123456789',
  companyAddress: 'Av. Lima 123',
  companyPhone: '999111222',
  headerText: '',
  footerText: '',
  showLogo: true,
  showCompany: true,
  showCustomer: true,
  showEmployee: true,
  showItems: true,
  showSubtotal: true,
  showTax: true,
  showDiscount: true,
  showSaleNumber: true,
  showSaleDate: true,
  showSaleTime: true,
  showPaymentMethod: true,
  logoSrc: null,
  taxPercentage: 18,
  isDefault: true,
  isGlobal: true,
};

describe('InvoicesService tenant scoping', () => {
  it('queries the sale scoped to the caller company and 404s on cross-tenant sale', async () => {
    let saleWhere: any;
    const prisma = {
      invoiceTemplate: { findFirst: async () => TEMPLATE },
      sale: {
        findFirst: async (args: any) => {
          saleWhere = args.where;
          return null;
        },
      },
    } as any;
    const svc = new InvoicesService(prisma);

    await assert.rejects(
      () => svc.generateInvoiceHtml('sale-other', 'com-a'),
      NotFoundException,
    );
    assert.deepEqual(saleWhere, { id: 'sale-other', companyId: 'com-a' });
  });

  it('generates the html for a sale that belongs to the caller company', async () => {
    const prisma = {
      invoiceTemplate: { findFirst: async () => TEMPLATE },
      sale: {
        findFirst: async (args: any) => ({
          id: args.where.id,
          saleNumber: 'SALE-1',
          company: { name: 'Mi Empresa', taxId: '20123456789' },
          customer: { firstName: 'Juan', lastName: 'Perez', documentType: 'DNI', documentValue: '44556677' },
          employee: { firstName: 'Ana', lastName: 'Lopez' },
          createdAt: new Date('2026-10-06T12:00:00Z'),
          paymentMethod: 'YAPE',
          items: [
            {
              quantity: 2,
              unitPrice: 50,
              totalAmount: 100,
              product: { name: 'Producto A' },
            },
          ],
        }),
      },
    } as any;
    const svc = new InvoicesService(prisma);

    const { html } = await svc.generateInvoiceHtml('sale-a', 'com-a');
    assert.match(html, /Mi Empresa/);
    assert.match(html, /Producto A/);
  });
});