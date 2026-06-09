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

  const [superAdmin, supportAdmin, acmeAdminUser, acmeManagerUser, acmeCashierUser] = await Promise.all([
    upsertUser({ email: 'superadmin@ventas-saas.local', fullName: 'Super Admin', password, globalRole: 'SUPER_ADMIN' }),
    upsertUser({ email: 'support@ventas-saas.local', fullName: 'Support Team', password, globalRole: 'SUPPORT_ADMIN' }),
    upsertUser({ email: 'admin@acme.local', fullName: 'Admin Acme', password, globalRole: 'USER' }),
    upsertUser({ email: 'manager@acme.local', fullName: 'Manager Acme', password, globalRole: 'USER' }),
    upsertUser({ email: 'cajero@acme.local', fullName: 'Cajero Acme', password, globalRole: 'USER' }),
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

  const [membership1, membership2, membership3] = await Promise.all([
    prisma.membership.upsert({
      where: { userId_companyId: { userId: acmeAdminUser.id, companyId: acmeCompany.id } },
      update: { role: 'COMPANY_ADMIN' },
      create: {
        userId: acmeAdminUser.id,
        companyId: acmeCompany.id,
        role: 'COMPANY_ADMIN',
      },
    }),
    prisma.membership.upsert({
      where: { userId_companyId: { userId: acmeManagerUser.id, companyId: acmeCompany.id } },
      update: { role: 'MANAGER' },
      create: {
        userId: acmeManagerUser.id,
        companyId: acmeCompany.id,
        role: 'MANAGER',
      },
    }),
    prisma.membership.upsert({
      where: { userId_companyId: { userId: acmeCashierUser.id, companyId: acmeCompany.id } },
      update: { role: 'CASHIER' },
      create: {
        userId: acmeCashierUser.id,
        companyId: acmeCompany.id,
        role: 'CASHIER',
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
    update: { userId: acmeAdminUser.id, role: 'COMPANY_ADMIN', firstName: 'Admin', lastName: 'Acme' },
    create: {
      id: 'emp-admin',
      companyId: acmeCompany.id,
      userId: acmeAdminUser.id,
      firstName: 'Admin',
      lastName: 'Acme',
      role: 'COMPANY_ADMIN',
      isActive: true,
    },
  });

  const employeeManager = await prisma.employee.upsert({
    where: { id: 'emp-manager' },
    update: { userId: acmeManagerUser.id, role: 'MANAGER', firstName: 'Manager', lastName: 'Acme' },
    create: {
      id: 'emp-manager',
      companyId: acmeCompany.id,
      userId: acmeManagerUser.id,
      firstName: 'Manager',
      lastName: 'Acme',
      role: 'MANAGER',
      isActive: true,
    },
  });

  const employeeCashier = await prisma.employee.upsert({
    where: { id: 'emp-cashier' },
    update: { userId: acmeCashierUser.id, role: 'CASHIER', firstName: 'Cajero', lastName: 'Acme' },
    create: {
      id: 'emp-cashier',
      companyId: acmeCompany.id,
      userId: acmeCashierUser.id,
      firstName: 'Cajero',
      lastName: 'Acme',
      role: 'CASHIER',
      isActive: true,
    },
  });

  const paymentSettings = await Promise.all([
    prisma.paymentSetting.upsert({
      where: { provider: 'YAPE' },
      update: {},
      create: {
        provider: 'YAPE',
        config: { type: 'mobile' },
        accountNumber: '999587587',
        accountName: 'Cesar (Super Admin)',
        instructions: 'Escanea el código QR o envía el pago al número Yape indicado.',
        isEnabled: true,
      },
    }),
    prisma.paymentSetting.upsert({
      where: { provider: 'PLIN' },
      update: {},
      create: {
        provider: 'PLIN',
        config: { type: 'mobile' },
        accountNumber: '999587588',
        accountName: 'Cesar (Super Admin)',
        instructions: 'Escanea el código QR o envía el pago al número Plin indicado.',
        isEnabled: true,
      },
    }),
    prisma.paymentSetting.upsert({
      where: { provider: 'TRANSFER' },
      update: {},
      create: {
        provider: 'TRANSFER',
        config: { type: 'bank_transfer' },
        accountNumber: '191-1234567-0-00',
        accountName: 'Cesar (Super Admin)',
        instructions: 'Realiza la transferencia bancaria a la cuenta indicada y sube el comprobante.',
        isEnabled: true,
      },
    }),
    prisma.paymentSetting.upsert({
      where: { provider: 'STRIPE' },
      update: {},
      create: {
        provider: 'STRIPE',
        config: { type: 'card', publishableKey: 'pk_test_...', secretKey: 'sk_test_...' },
        instructions: 'Pago con tarjeta de crédito/débito vía Stripe.',
        isEnabled: true,
      },
    }),
    prisma.paymentSetting.upsert({
      where: { provider: 'MERCADOPAGO' },
      update: {},
      create: {
        provider: 'MERCADOPAGO',
        config: { type: 'card', publicKey: 'TEST-...', accessToken: 'TEST-...' },
        instructions: 'Pago con tarjeta de crédito/débito vía MercadoPago.',
        isEnabled: true,
      },
    }),
  ]);

  console.log('Seeded successfully!');
  console.log('\nDemo credentials:');
  console.log('- superadmin@ventas-saas.local / Admin123! (Super Admin - acceso total plataforma)');
  console.log('- support@ventas-saas.local / Admin123! (Support Admin - administracion plataforma)');
  console.log('- admin@acme.local / Admin123! (Company Admin - administra Acme Corp)');
  console.log('- manager@acme.local / Admin123! (Manager - gestiona Acme Corp)');
  console.log('- cajero@acme.local / Admin123! (Cashier - POS Acme Corp)');

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