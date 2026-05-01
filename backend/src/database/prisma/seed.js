require('dotenv').config();
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

  const [freePlan, starterPlan, growthPlan, scalePlan] = await Promise.all([
    prisma.plan.upsert({
      where: { code: 'FREE' },
      update: {},
      create: {
        code: 'FREE',
        name: 'Free',
        description: 'Plan gratuito con funciones basicas.',
        priceMonthly: '0.00',
        priceYearly: '0.00',
        billingCycle: 'MONTHLY',
        maxUsers: 1,
        maxProducts: 50,
        features: ['1 usuario', '50 productos', '1 sucursal', 'POS basico'],
      },
    }),
    prisma.plan.upsert({
      where: { code: 'START' },
      update: {},
      create: {
        code: 'START',
        name: 'Startup',
        description: 'Plan ideal para pequena empresas.',
        priceMonthly: '49.00',
        priceYearly: '490.00',
        billingCycle: 'MONTHLY',
        maxUsers: 3,
        maxProducts: 500,
        features: ['3 usuarios', '500 productos', '3 sucursales', 'POS completo', 'Reportes basicos'],
      },
    }),
    prisma.plan.upsert({
      where: { code: 'GROWTH' },
      update: {},
      create: {
        code: 'GROWTH',
        name: 'Growth',
        description: 'Plan para empresas en crecimiento.',
        priceMonthly: '99.00',
        priceYearly: '990.00',
        billingCycle: 'MONTHLY',
        maxUsers: 10,
        maxProducts: 5000,
        features: ['10 usuarios', '5000 productos', 'sucursales ilimitadas', 'POS completo', 'Reportes avanzados', 'API'],
      },
    }),
    prisma.plan.upsert({
      where: { code: 'SCALE' },
      update: {},
      create: {
        code: 'SCALE',
        name: 'Scale',
        description: 'Plan enterprise para grandes empresas.',
        priceMonthly: '199.00',
        priceYearly: '1990.00',
        billingCycle: 'MONTHLY',
        maxUsers: 999,
        maxProducts: 999999,
        features: ['Sucursales ilimitadas', 'API', 'Webhooks'],
      },
    }),
  ]);

  const [superAdmin, subAdmin, supportAdmin] = await Promise.all([
    upsertUser({ email: 'superadmin@ventas-saas.local', fullName: 'Super Admin', password, globalRole: 'SUPER_ADMIN' }),
    upsertUser({ email: 'subadmin@ventas-saas.local', fullName: 'Sub Admin', password, globalRole: 'ADMIN' }),
    upsertUser({ email: 'support@ventas-saas.local', fullName: 'Support Team', password, globalRole: 'ADMIN' }),
  ]);

  const acmeCompany = await prisma.company.upsert({
    where: { slug: 'acme' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Acme Corp',
      slug: 'acme',
      email: 'admin@acme.local',
      timezone: 'America/Lima',
      currency: 'PEN',
      status: 'ACTIVE',
    },
  });

  const novaCompany = await prisma.company.upsert({
    where: { slug: 'nova' },
    update: { status: 'ACTIVE' },
    create: {
      name: 'Nova Tech',
      slug: 'nova',
      email: 'admin@nova.local',
      timezone: 'America/Lima',
      currency: 'USD',
      status: 'TRIAL',
    },
  });

  const [membership1, membership2, membershipNova] = await Promise.all([
    prisma.membership.upsert({
      where: { userId_companyId: { userId: superAdmin.id, companyId: acmeCompany.id } },
      update: { role: 'COMPANY_ADMIN' },
      create: {
        userId: superAdmin.id,
        companyId: acmeCompany.id,
        role: 'COMPANY_ADMIN',
      },
    }),
    prisma.membership.upsert({
      where: { userId_companyId: { userId: subAdmin.id, companyId: acmeCompany.id } },
      update: { role: 'MANAGER' },
      create: {
        userId: subAdmin.id,
        companyId: acmeCompany.id,
        role: 'MANAGER',
      },
    }),
    prisma.membership.upsert({
      where: { userId_companyId: { userId: subAdmin.id, companyId: novaCompany.id } },
      update: { role: 'COMPANY_ADMIN' },
      create: {
        userId: subAdmin.id,
        companyId: novaCompany.id,
        role: 'COMPANY_ADMIN',
      },
    }),
    prisma.membership.upsert({
      where: { userId_companyId: { userId: supportAdmin.id, companyId: acmeCompany.id } },
      update: { role: 'VIEWER' },
      create: {
        userId: supportAdmin.id,
        companyId: acmeCompany.id,
        role: 'VIEWER',
      },
    }),
  ]);

  const [category1, category2] = await Promise.all([
    prisma.category.upsert({
      where: { id: 'cat-general' },
      update: {},
      create: {
        id: 'cat-general',
        companyId: acmeCompany.id,
        name: 'General',
        slug: 'general',
      },
    }),
    prisma.category.upsert({
      where: { id: 'cat-bebidas' },
      update: {},
      create: {
        id: 'cat-bebidas',
        companyId: acmeCompany.id,
        name: 'Bebidas',
        slug: 'bebidas',
      },
    }),
  ]);

  const [product1, product2] = await Promise.all([
    prisma.product.upsert({
      where: { id: 'prod-cafe' },
      update: {},
      create: {
        id: 'prod-cafe',
        companyId: acmeCompany.id,
        name: 'Cafe Premium',
        sku: 'CAFE-001',
        salePrice: '15.00',
        stockQuantity: 100,
        minStock: 10,
      },
    }),
    prisma.product.upsert({
      where: { id: 'prod-pan' },
      update: {},
      create: {
        id: 'prod-pan',
        companyId: acmeCompany.id,
        name: 'Pan Frances',
        sku: 'PAN-001',
        salePrice: '3.50',
        stockQuantity: 50,
        minStock: 5,
      },
    }),
  ]);

  const [customerOne, customerTwo] = await Promise.all([
    prisma.customer.upsert({
      where: { id: 'cust-001' },
      update: {},
      create: {
        id: 'cust-001',
        companyId: acmeCompany.id,
        firstName: 'Juan',
        lastName: 'Perez',
        documentType: 'DNI',
        documentValue: '12345678',
      },
    }),
    prisma.customer.upsert({
      where: { id: 'cust-002' },
      update: {},
      create: {
        id: 'cust-002',
        companyId: acmeCompany.id,
        firstName: 'Maria',
        lastName: 'Garcia',
        documentType: 'RUC',
        documentValue: '20123456789',
      },
    }),
  ]);

  const employeeAdmin = await prisma.employee.upsert({
    where: { id: 'emp-admin' },
    update: {},
    create: {
      id: 'emp-admin',
      companyId: acmeCompany.id,
      userId: superAdmin.id,
      firstName: 'Admin',
      lastName: 'Acme',
      role: 'COMPANY_ADMIN',
      isActive: true,
    },
  });

  const employeeManager = await prisma.employee.upsert({
    where: { id: 'emp-manager' },
    update: {},
    create: {
      id: 'emp-manager',
      companyId: acmeCompany.id,
      userId: subAdmin.id,
      firstName: 'Manager',
      lastName: 'Acme',
      role: 'MANAGER',
      isActive: true,
    },
  });

  const employeeCashier = await prisma.employee.upsert({
    where: { id: 'emp-cashier' },
    update: {},
    create: {
      id: 'emp-cashier',
      companyId: acmeCompany.id,
      firstName: 'Cajero',
      lastName: 'Acme',
      role: 'CASHIER',
      isActive: true,
    },
  });

  console.log('Seeded successfully!');
  console.log('\nDemo credentials:');
  console.log('- superadmin@ventas-saas.local / Admin123! (Super Admin)');
  console.log('- admin@acme.local / Admin123! (Company Admin)');
  console.log('- manager@acme.local / Admin123! (Manager)');
  console.log('- cajero@acme.local / Admin123! (Cashier)');

  await prisma.$disconnect();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });