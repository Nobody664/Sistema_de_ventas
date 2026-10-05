import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured before running the seed.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  }),
});

/**
 * Seed base: solo el catalogo que el sistema necesita para funcionar.
 * No crea usuarios, empresas ni datos de negocio. Es idempotente y nunca
 * borra nada. Para datos de prueba usar `npm run db:seed:demo`.
 */
const PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'Plan gratuito con funciones basicas.',
    priceMonthly: '0.00',
    priceYearly: '0.00',
    billingCycle: 'MONTHLY' as const,
    maxUsers: 1,
    maxProducts: 50,
    features: ['1 usuario', '50 productos', '1 sucursal', 'POS basico'],
  },
  {
    code: 'START',
    name: 'Startup',
    description: 'Plan ideal para pequena empresas.',
    priceMonthly: '49.00',
    priceYearly: '490.00',
    billingCycle: 'MONTHLY' as const,
    maxUsers: 3,
    maxProducts: 500,
    features: ['3 usuarios', '500 productos', '3 sucursales', 'POS completo', 'Reportes basicos'],
  },
  {
    code: 'GROWTH',
    name: 'Growth',
    description: 'Plan para empresas en crecimiento.',
    priceMonthly: '99.00',
    priceYearly: '990.00',
    billingCycle: 'MONTHLY' as const,
    maxUsers: 10,
    maxProducts: 5000,
    features: [
      '10 usuarios',
      '5000 productos',
      'sucursales ilimitadas',
      'POS completo',
      'Reportes avanzados',
      'API',
    ],
  },
  {
    code: 'SCALE',
    name: 'Scale',
    description: 'Plan enterprise para grandes empresas.',
    priceMonthly: '199.00',
    priceYearly: '1990.00',
    billingCycle: 'MONTHLY' as const,
    maxUsers: 999,
    maxProducts: 999999,
    features: ['Sucursales ilimitadas', 'API', 'Webhooks'],
  },
];

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {},
      create: plan,
    });
  }

  const total = await prisma.plan.count();

  console.log(`Seed base OK: ${PLANS.length} planes del catalogo (${total} en total).`);
  console.log('Este seed no crea usuarios ni empresas y no borra datos.');
  console.log('Para datos de prueba: npm run db:seed:demo');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });