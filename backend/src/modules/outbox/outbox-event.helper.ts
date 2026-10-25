import { Prisma } from "@prisma/client";

export type DomainEffect =
  | "PAYMENT_CONFIRMED"
  | "UPGRADE_REVIEWED"
  | "CHECKOUT_SUBMITTED"
  | "CHECKOUT_REVIEWED"
  | "SALE_COMMITTED";

export async function enqueueDomainEffect(
  tx: Prisma.TransactionClient,
  kind: DomainEffect,
  aggregateId: string,
): Promise<void> {
  await tx.outboxEvent.upsert({
    where: { dedupeKey: `${kind}:${aggregateId}` },
    create: { dedupeKey: `${kind}:${aggregateId}`, kind, aggregateId },
    update: {},
  });
}
