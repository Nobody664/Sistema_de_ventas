const argon2 = require('argon2');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function upsertUser({ email, fullName, password, globalRole = 'USER' }) {
  const passwordHash = await argon2.hash(password);

  return prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      passwordHash,
      globalRole,
      isActive: true,
    },
    create: {
      email,
      fullName,
      passwordHash,
      globalRole,
    },
  });
}

async function main() {
  const password = 'Admin123!';

  const [starterPlan, growthPlan, scalePlan] = await Promise.all([
    prisma.plan.upsert({
      where: { code: 'START' },
      update: {},
      create: {
        code: 'START',
        name: 'Start',
        description: 'Plan para negocios pequeños.',
        priceMonthly: '19.00',
        priceYearly: '190.00',
        billingCycle: 'MONTHLY',
        maxUsers: 3,
        maxProducts: 500,
        features: ['1 sucursal', 'POS', 'Inventario básico'],
      },
    }),
    prisma.plan.upsert({
      where: { code: 'GROWTH' },
      update: {},
      create: {
        code: 'GROWTH',
        name: 'Growth',
        description: 'Plan para empresas en expansión.',
        priceMonthly: '59.00',
        priceYearly: '590.00',
        billingCycle: 'MONTHLY',
        maxUsers: 15,
        maxProducts: 10000,
        features: ['3 sucursales', 'Reportes', 'Roles'],
      },
    }),
    prisma.plan.upsert({
      where: { code: 'SCALE' },
      update: {},
      create: {
        code: 'SCALE',
        name: 'Scale',
        description: 'Plan enterprise inicial.',
        priceMonthly: '149.00',
        priceYearly: '1490.00',
        billingCycle: 'MONTHLY',
        maxUsers: 999,
        maxProducts: 999999,
        features: ['Sucursales ilimitadas', 'API', 'Webhooks'],
      },
    }),
  ]);

  const superAdmin = await upsertUser({
    email: 'superadmin@ventas-saas.local',
    fullName: 'Super Admin SaaS',
    password,
    globalRole: 'SUPER_ADMIN',
  });

  const supportAdmin = await upsertUser({
    email: 'subadmin@ventas-saas.local',
    fullName: 'Subadmin SaaS',
    password,
    globalRole: 'SUPPORT_ADMIN',
  });

  const acmeCompany = await prisma.company.upsert({
    where: { slug: 'acme-retail' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Acme Retail',
      slug: 'acme-retail',
      legalName: 'Acme Retail SAC',
      email: 'contacto@acme.local',
      phone: '+51 900 111 111',
      currency: 'PEN',
      status: 'ACTIVE',
    },
  });

  const novaCompany = await prisma.company.upsert({
    where: { slug: 'nova-market' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Nova Market',
      slug: 'nova-market',
      legalName: 'Nova Market SAC',
      email: 'contacto@nova.local',
      phone: '+51 900 222 222',
      currency: 'PEN',
      status: 'ACTIVE',
    },
  });

  const [ownerAcme, managerAcme, cashierAcme, ownerNova] = await Promise.all([
    upsertUser({
      email: 'admin@acme.local',
      fullName: 'Admin Acme',
      password,
    }),
    upsertUser({
      email: 'manager@acme.local',
      fullName: 'Manager Acme',
      password,
    }),
    upsertUser({
      email: 'cajero@acme.local',
      fullName: 'Cajero Acme',
      password,
    }),
    upsertUser({
      email: 'admin@nova.local',
      fullName: 'Admin Nova',
      password,
    }),
  ]);

  await Promise.all([
    prisma.companyMembership.upsert({
      where: {
        companyId_userId: {
          companyId: acmeCompany.id,
          userId: ownerAcme.id,
        },
      },
      update: { role: 'COMPANY_ADMIN', isActive: true },
      create: {
        companyId: acmeCompany.id,
        userId: ownerAcme.id,
        role: 'COMPANY_ADMIN',
      },
    }),
    prisma.companyMembership.upsert({
      where: {
        companyId_userId: {
          companyId: acmeCompany.id,
          userId: managerAcme.id,
        },
      },
      update: { role: 'MANAGER', isActive: true },
      create: {
        companyId: acmeCompany.id,
        userId: managerAcme.id,
        role: 'MANAGER',
      },
    }),
    prisma.companyMembership.upsert({
      where: {
        companyId_userId: {
          companyId: acmeCompany.id,
          userId: cashierAcme.id,
        },
      },
      update: { role: 'CASHIER', isActive: true },
      create: {
        companyId: acmeCompany.id,
        userId: cashierAcme.id,
        role: 'CASHIER',
      },
    }),
    prisma.companyMembership.upsert({
      where: {
        companyId_userId: {
          companyId: novaCompany.id,
          userId: ownerNova.id,
        },
      },
      update: { role: 'COMPANY_ADMIN', isActive: true },
      create: {
        companyId: novaCompany.id,
        userId: ownerNova.id,
        role: 'COMPANY_ADMIN',
      },
    }),
  ]);

  await prisma.payment.deleteMany({
    where: {
      subscription: {
        companyId: {
          in: [acmeCompany.id, novaCompany.id],
        },
      },
    },
  });

  await prisma.auditLog.deleteMany({
    where: {
      companyId: {
        in: [acmeCompany.id, novaCompany.id],
      },
    },
  });

  await prisma.inventoryMovement.deleteMany({
    where: {
      companyId: {
        in: [acmeCompany.id, novaCompany.id],
      },
    },
  });

  await prisma.sale.deleteMany({
    where: {
      companyId: {
        in: [acmeCompany.id, novaCompany.id],
      },
    },
  });

  await prisma.employee.deleteMany({
    where: {
      companyId: {
        in: [acmeCompany.id, novaCompany.id],
      },
    },
  });

  await prisma.customer.deleteMany({
    where: {
      companyId: {
        in: [acmeCompany.id, novaCompany.id],
      },
    },
  });

  await prisma.product.deleteMany({
    where: {
      companyId: {
        in: [acmeCompany.id, novaCompany.id],
      },
    },
  });

  await prisma.category.deleteMany({
    where: {
      companyId: {
        in: [acmeCompany.id, novaCompany.id],
      },
    },
  });

  await Promise.all([
    prisma.subscription.upsert({
      where: { companyId: acmeCompany.id },
      update: {
        planId: growthPlan.id,
        status: 'ACTIVE',
        provider: 'STRIPE',
        billingCycle: 'MONTHLY',
        startDate: new Date(),
      },
      create: {
        companyId: acmeCompany.id,
        planId: growthPlan.id,
        status: 'ACTIVE',
        provider: 'STRIPE',
        billingCycle: 'MONTHLY',
        startDate: new Date(),
      },
    }),
    prisma.subscription.upsert({
      where: { companyId: novaCompany.id },
      update: {
        planId: scalePlan.id,
        status: 'ACTIVE',
        provider: 'MERCADOPAGO',
        billingCycle: 'MONTHLY',
        startDate: new Date(),
      },
      create: {
        companyId: novaCompany.id,
        planId: scalePlan.id,
        status: 'ACTIVE',
        provider: 'MERCADOPAGO',
        billingCycle: 'MONTHLY',
        startDate: new Date(),
      },
    }),
  ]);

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { companyId_slug: { companyId: acmeCompany.id, slug: 'cafeteria' } },
      update: {},
      create: {
        companyId: acmeCompany.id,
        name: 'Cafetería',
        slug: 'cafeteria',
      },
    }),
    prisma.category.upsert({
      where: { companyId_slug: { companyId: acmeCompany.id, slug: 'accesorios' } },
      update: {},
      create: {
        companyId: acmeCompany.id,
        name: 'Accesorios',
        slug: 'accesorios',
      },
    }),
  ]);

  const acmeProducts = await Promise.all([
    prisma.product.upsert({
      where: { companyId_sku: { companyId: acmeCompany.id, sku: 'ACM-CAFE-001' } },
      update: { stockQuantity: 120, salePrice: '48.00' },
      create: {
        companyId: acmeCompany.id,
        categoryId: categories[0].id,
        sku: 'ACM-CAFE-001',
        barcode: '100000000001',
        name: 'Café Premium 1kg',
        description: 'Café de especialidad.',
        costPrice: '28.00',
        salePrice: '48.00',
        stockQuantity: 120,
        minStock: 15,
      },
    }),
    prisma.product.upsert({
      where: { companyId_sku: { companyId: acmeCompany.id, sku: 'ACM-MSE-002' } },
      update: { stockQuantity: 60, salePrice: '89.00' },
      create: {
        companyId: acmeCompany.id,
        categoryId: categories[1].id,
        sku: 'ACM-MSE-002',
        barcode: '100000000002',
        name: 'Mouse inalámbrico',
        description: 'Mouse ergonómico.',
        costPrice: '49.00',
        salePrice: '89.00',
        stockQuantity: 60,
        minStock: 10,
      },
    }),
  ]);

  const [customerOne, customerTwo] = await Promise.all([
    prisma.customer.create({
      data: {
        companyId: acmeCompany.id,
        firstName: 'Lucía',
        lastName: 'Paredes',
        email: 'lucia@cliente.local',
        phone: '+51 900 333 333',
      },
    }),
    prisma.customer.create({
      data: {
        companyId: acmeCompany.id,
        firstName: 'Marco',
        lastName: 'Salinas',
        email: 'marco@cliente.local',
        phone: '+51 900 444 444',
      },
    }),
  ]);

  const [employeeAdmin, employeeManager, employeeCashier] = await Promise.all([
    prisma.employee.create({
      data: {
        companyId: acmeCompany.id,
        userId: ownerAcme.id,
        firstName: 'Admin',
        lastName: 'Acme',
        email: 'admin@acme.local',
        role: 'COMPANY_ADMIN',
      },
    }),
    prisma.employee.create({
      data: {
        companyId: acmeCompany.id,
        userId: managerAcme.id,
        firstName: 'Manager',
        lastName: 'Acme',
        email: 'manager@acme.local',
        role: 'MANAGER',
      },
    }),
    prisma.employee.create({
      data: {
        companyId: acmeCompany.id,
        userId: cashierAcme.id,
        firstName: 'Cajero',
        lastName: 'Acme',
        email: 'cajero@acme.local',
        role: 'CASHIER',
      },
    }),
  ]);

  const saleOne = await prisma.sale.create({
    data: {
      companyId: acmeCompany.id,
      customerId: customerOne.id,
      employeeId: employeeCashier.id,
      saleNumber: 'ACM-SALE-1001',
      subtotal: '137.00',
      taxAmount: '24.66',
      discountAmount: '0.00',
      totalAmount: '161.66',
      paymentMethod: 'CARD',
      paidAt: new Date(),
      items: {
        create: [
          {
            productId: acmeProducts[0].id,
            quantity: 1,
            unitPrice: '48.00',
            discountAmount: '0.00',
            totalAmount: '48.00',
          },
          {
            productId: acmeProducts[1].id,
            quantity: 1,
            unitPrice: '89.00',
            discountAmount: '0.00',
            totalAmount: '89.00',
          },
        ],
      },
    },
  });

  await Promise.all([
    prisma.inventoryMovement.create({
      data: {
        companyId: acmeCompany.id,
        productId: acmeProducts[0].id,
        type: 'INBOUND',
        quantity: 120,
        unitCost: '28.00',
        reason: 'Stock inicial',
      },
    }),
    prisma.inventoryMovement.create({
      data: {
        companyId: acmeCompany.id,
        productId: acmeProducts[1].id,
        type: 'INBOUND',
        quantity: 60,
        unitCost: '49.00',
        reason: 'Stock inicial',
      },
    }),
    prisma.inventoryMovement.create({
      data: {
        companyId: acmeCompany.id,
        productId: acmeProducts[0].id,
        type: 'OUTBOUND',
        quantity: -1,
        reason: `Venta ${saleOne.saleNumber}`,
        referenceId: saleOne.id,
      },
    }),
    prisma.inventoryMovement.create({
      data: {
        companyId: acmeCompany.id,
        productId: acmeProducts[1].id,
        type: 'OUTBOUND',
        quantity: -1,
        reason: `Venta ${saleOne.saleNumber}`,
        referenceId: saleOne.id,
      },
    }),
  ]);

  const acmeSubscription = await prisma.subscription.findUnique({
    where: { companyId: acmeCompany.id },
  });

  if (acmeSubscription) {
    await prisma.payment.create({
      data: {
        subscriptionId: acmeSubscription.id,
        provider: 'STRIPE',
        transactionId: 'pi_demo_1001',
        amount: '59.00',
        currency: 'USD',
        status: 'SUCCEEDED',
      },
    });
  }

  await prisma.auditLog.createMany({
    data: [
      {
        companyId: acmeCompany.id,
        userId: superAdmin.id,
        action: 'SEED_BOOTSTRAP',
        entity: 'Company',
        entityId: acmeCompany.id,
        metadata: { note: 'Bootstrap seed completed for Acme.' },
      },
      {
        companyId: acmeCompany.id,
        userId: employeeManager.userId,
        action: 'SALE_CREATED',
        entity: 'Sale',
        entityId: saleOne.id,
        metadata: { customerId: customerOne.id, cashierId: employeeCashier.id },
      },
      {
        companyId: acmeCompany.id,
        userId: employeeAdmin.userId,
        action: 'CUSTOMER_REGISTERED',
        entity: 'Customer',
        entityId: customerTwo.id,
        metadata: { source: 'seed' },
      },
      {
        userId: supportAdmin.id,
        action: 'SUPPORT_ACCESS_READY',
        entity: 'User',
        entityId: supportAdmin.id,
        metadata: { scope: 'SaaS' },
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed completed.');
  console.log('Demo credentials:');
  console.log('superadmin@ventas-saas.local / Admin123!');
  console.log('subadmin@ventas-saas.local / Admin123!');
  console.log('admin@acme.local / Admin123!');
  console.log('manager@acme.local / Admin123!');
  console.log('cajero@acme.local / Admin123!');
  console.log('admin@nova.local / Admin123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
