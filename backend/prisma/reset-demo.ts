import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare const process: {
  env: Record<string, string | undefined>;
  exitCode?: number;
  argv: string[];
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured before running the reset.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  }),
});

type DelegateName =
  | 'paymentProof'
  | 'payment'
  | 'subscription'
  | 'planUpgradeRequest'
  | 'checkoutRequest'
  | 'saleItem'
  | 'sale'
  | 'inventoryMovement'
  | 'inventoryKardex'
  | 'productBatch'
  | 'auditLog'
  | 'refreshToken'
  | 'notification'
  | 'employee'
  | 'membership'
  | 'invoiceTemplate'
  | 'customer'
  | 'category'
  | 'product'
  | 'branch'
  | 'company'
  | 'user'
  | 'plan';

type Table = {
  count(args?: { where?: unknown }): Promise<number>;
  deleteMany(args: { where?: unknown }): Promise<{ count: number }>;
};

/**
 * Orden derivado de prisma/schema.prisma: los hijos se borran antes que los
 * padres. SaleItem.productId es Restrict, por eso los items de venta deben
 * eliminarse antes que Product. Plan se borra al final porque
 * Subscription/PlanUpgradeRequest/CheckoutRequest lo referencian con NoAction.
 */
const TABLES: { name: DelegateName; label: string }[] = [
  { name: 'paymentProof', label: 'payment_proofs' },
  { name: 'payment', label: 'payments' },
  { name: 'subscription', label: 'subscriptions' },
  { name: 'planUpgradeRequest', label: 'plan_upgrade_requests' },
  { name: 'checkoutRequest', label: 'checkout_requests' },
  { name: 'saleItem', label: 'sale_items' },
  { name: 'sale', label: 'sales' },
  { name: 'inventoryMovement', label: 'inventory_movements' },
  { name: 'inventoryKardex', label: 'inventory_kardex' },
  { name: 'productBatch', label: 'product_batches' },
  { name: 'auditLog', label: 'audit_logs' },
  { name: 'refreshToken', label: 'refresh_tokens' },
  { name: 'notification', label: 'notifications' },
  { name: 'employee', label: 'employees' },
  { name: 'membership', label: 'memberships' },
  { name: 'invoiceTemplate', label: 'invoice_templates' },
  { name: 'customer', label: 'customers' },
  { name: 'category', label: 'categories' },
  { name: 'product', label: 'products' },
  { name: 'branch', label: 'branches' },
  { name: 'company', label: 'companies' },
  { name: 'user', label: 'users' },
  { name: 'plan', label: 'plans' },
];

/** Tablas que sescopean por userId en vez de companyId. */
const USER_SCOPED: DelegateName[] = ['refreshToken', 'notification'];

/** Tablas que se alcanzan via subscriptionId (no tienen companyId directo). */
const SUBSCRIPTION_SCOPED: DelegateName[] = ['payment', 'paymentProof'];
const SALE_ITEM_SCOPED: DelegateName[] = ['saleItem'];

const DEMO_SLUGS = ['acme', 'nova'];
const DEMO_EMAILS = [
  'superadmin@ventas-saas.local',
  'support@ventas-saas.local',
  'admin@acme.local',
  'manager@acme.local',
  'cajero@acme.local',
];

function db(): Record<DelegateName, Table> {
  return prisma as unknown as Record<DelegateName, Table>;
}

async function main(): Promise<void> {
  const argv = process.argv;
  const fullWipe = argv.includes('--all');
  const demoOnly = !fullWipe;

  const confirmed =
    argv.includes('--confirm') || process.env.SEED_RESET_CONFIRM === 'true';

  if (!confirmed) {
    console.error('ABORTADO: el reset borra datos. Nada se modifico.');
    console.error('  npm run db:reset:demo   -> solo borra los tenants demo (acme, nova)');
    console.error('  npm run db:reset:all    -> borra TODAS las tablas, incluido el catalogo');
    throw new Error('Falta --confirm.');
  }

  // Prisma no admite filtros de relacion en count/deleteMany, asi que se
  // resuelven los IDs primero y se filtran por columnas escalares.
  const companies = demoOnly
    ? await db().company.findMany({
        where: { slug: { in: DEMO_SLUGS } },
        select: { id: true },
      })
    : [];
  const companyIds = companies.map((c) => c.id);

  const users = demoOnly
    ? await db().user.findMany({
        where: { email: { in: DEMO_EMAILS } },
        select: { id: true },
      })
    : [];
  const userIds = users.map((u) => u.id);

  const subscriptionIds = demoOnly
    ? (
        await db().subscription.findMany({
          where: { companyId: { in: companyIds } },
          select: { id: true },
        })
      ).map((s) => s.id)
    : [];

  const saleIds = demoOnly
    ? (
        await db().sale.findMany({
          where: { companyId: { in: companyIds } },
          select: { id: true },
        })
      ).map((s) => s.id)
    : [];

  const whereFor = (name: DelegateName): Record<string, unknown> => {
    if (!demoOnly) return {};
    if (name === 'plan') return { id: '__none__' };
    if (name === 'user') return { id: { in: userIds } };
    if (name === 'company') return { id: { in: companyIds } };
    if (USER_SCOPED.includes(name)) return { userId: { in: userIds } };
    if (SUBSCRIPTION_SCOPED.includes(name)) return { subscriptionId: { in: subscriptionIds } };
    if (SALE_ITEM_SCOPED.includes(name)) return { saleId: { in: saleIds } };
    return { companyId: { in: companyIds } };
  };

  const scopeLabel = demoOnly
    ? `solo tenants demo (${DEMO_SLUGS.join(', ')}) y usuarios ${DEMO_EMAILS.length} de prueba`
    : 'TODAS las tablas (incluye catalogo de planes y cualquier empresa real)';

  console.log(`Alcance: ${scopeLabel}\n`);

  console.log('=== Estado antes ===');
  for (const { name, label } of TABLES) {
    console.log(`${label.padEnd(24)} ${await db()[name].count({ where: whereFor(name) })}`);
  }

  console.log('\n=== Borrando (orden de dependencias) ===');
  for (const { name, label } of TABLES) {
    const deleted = await db()[name].deleteMany({ where: whereFor(name) });
    if (deleted.count > 0) {
      console.log(`${label.padEnd(24)} -${deleted.count}`);
    }
  }

  console.log('\n=== Verificacion ===');
  let remaining = 0;
  for (const { name, label } of TABLES) {
    const count = await db()[name].count({ where: whereFor(name) });
    if (count !== 0) {
      console.log(`PENDIENTE ${label} = ${count}`);
      remaining += count;
    }
  }

  if (demoOnly) {
    const plans = await db().plan.count({});
    console.log(`planes del catalogo intactos: ${plans}`);
  }

  console.log(
    remaining === 0
      ? 'Limpio. Corre: npm run db:seed:demo'
      : `Quedan ${remaining} filas en el alcance.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });