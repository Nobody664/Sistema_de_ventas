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

type Table = { count(): Promise<number>; deleteMany(args: unknown): Promise<{ count: number }> };

function db(): Record<DelegateName, Table> {
  return prisma as unknown as Record<DelegateName, Table>;
}

async function countOf(name: DelegateName): Promise<number> {
  return db()[name].count();
}

async function deleteOf(name: DelegateName): Promise<number> {
  const result = await db()[name].deleteMany({});
  return result.count;
}

async function reset(): Promise<void> {
  console.log('=== Estado antes del reset ===');
  for (const { name, label } of TABLES) {
    console.log(`${label.padEnd(24)} ${await countOf(name)}`);
  }

  console.log('\n=== Borrando (orden de dependencias) ===');
  for (const { name, label } of TABLES) {
    const deleted = await deleteOf(name);
    if (deleted > 0) {
      console.log(`${label.padEnd(24)} -${deleted}`);
    }
  }

  console.log('\n=== Verificacion ===');
  let remaining = 0;
  for (const { name, label } of TABLES) {
    const count = await countOf(name);
    if (count !== 0) {
      console.log(`PENDIENTE ${label} = ${count}`);
      remaining += count;
    }
  }

  console.log(remaining === 0 ? 'Base de datos limpia. Ya puedes correr el seed.' : `Quedan ${remaining} filas.`);
}

const confirmed = process.argv.includes('--confirm') || process.env.SEED_RESET_CONFIRM === 'true';

if (!confirmed) {
  console.error('ABORTADO: el reset borra todos los datos de la base de datos.');
  console.error('Reejecuta con:  npm run db:reset');
  console.error('o con:         SEED_RESET_CONFIRM=true ts-node prisma/reset-demo.ts');
  process.exitCode = 1;
} else {
  reset()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}