import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma, ProductExpiryProfile } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "@/database/prisma/prisma.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";
import { companyTimeZone } from "@/common/helpers/company-timezone.helper";
import { expiryState } from "./expiry-policy";

const PAGE_SIZE = 200;
const productSelect = {
  id: true,
  companyId: true,
  name: true,
  baseUnit: true,
  stockQuantity: true,
  isActive: true,
  deletedAt: true,
  expiryDate: true,
  expiryProfile: true,
  expiryWarningDays: true,
  company: { select: { timezone: true, status: true } },
  batches: {
    where: { quantityAvailable: { gt: 0 } },
    select: { id: true },
    take: 1,
  },
} satisfies Prisma.ProductSelect;
type ExpiryProduct = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
type ExpiryBatch = { id: string; companyId: string; batchNumber: string; quantityAvailable: Prisma.Decimal; expirationDate: Date | null; product: ExpiryProduct };
type Candidate = {
  product: ExpiryProduct;
  batchId: string | null;
  batchNumber: string | null;
  quantity: Prisma.Decimal;
  state: ReturnType<typeof expiryState>;
};

const eligibleProduct = {
  isActive: true,
  deletedAt: null,
  stockQuantity: { gt: 0 },
  company: { status: { in: ["ACTIVE", "TRIAL"] } },
} satisfies Prisma.ProductWhereInput;
const windows: Array<[ProductExpiryProfile, number]> = [
  ["PERISHABLE", 3],
  ["STANDARD", 30],
  ["LONG_LIFE", 93],
  ["CUSTOM", 3650],
];

@Injectable()
export class ExpiryAlertsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExpiryAlertsService.name);
  private running = false;
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onApplicationBootstrap(): void {
    void this.scan().catch(() =>
      this.logger.error("No se pudo iniciar la revisión de vigencias"),
    );
  }

  @Cron("0 */5 * * * *", { waitForCompletion: true })
  async scan(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    const now = new Date();
    let queued = 0;
    try {
      let after: string | undefined;
      while (true) {
        const products = await this.prisma.product.findMany({
          where: {
            ...eligibleProduct,
            batches: { none: { quantityAvailable: { gt: 0 } } },
            OR: windows.map(([expiryProfile, days]) => ({
              expiryProfile,
              expiryDate: {
                lte: new Date(now.getTime() + (days + 2) * 86400000),
              },
            })),
            ...(after ? { id: { gt: after } } : {}),
          },
          select: productSelect,
          orderBy: { id: "asc" },
          take: PAGE_SIZE,
        });
        queued += await this.enqueue(
          products.map((product) => this.candidate(product, null, now)),
        );
        if (products.length < PAGE_SIZE) break;
        after = products.at(-1)!.id;
      }
      after = undefined;
      while (true) {
        const batches: ExpiryBatch[] = await this.prisma.productBatch.findMany({
          where: {
            quantityAvailable: { gt: 0 },
            product: eligibleProduct,
            OR: windows.map(([expiryProfile, days]) => ({
              product: { expiryProfile },
              expirationDate: {
                lte: new Date(now.getTime() + (days + 2) * 86400000),
              },
            })),
            ...(after ? { id: { gt: after } } : {}),
          },
          select: {
            id: true,
            companyId: true,
            batchNumber: true,
            quantityAvailable: true,
            expirationDate: true,
            product: { select: productSelect },
          },
          orderBy: { id: "asc" },
          take: PAGE_SIZE,
        });
        queued += await this.enqueue(
          batches
            .filter((batch) => batch.companyId === batch.product.companyId)
            .map((batch) => this.candidate(batch.product, batch, now)),
        );
        if (batches.length < PAGE_SIZE) break;
        after = batches.at(-1)!.id;
      }
      if (queued) this.logger.log(`Avisos de vigencia preparados: ${queued}`);
      return queued;
    } catch (error) {
      this.logger.error(
        "No se completó la revisión de vigencias; se reintentará en el siguiente ciclo",
        error instanceof Error ? error.stack : undefined,
      );
      return queued;
    } finally {
      this.running = false;
    }
  }

  async checkProduct(companyId: string, productId: string): Promise<boolean> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId, ...eligibleProduct },
      select: productSelect,
    });
    if (!product) return false;
    const now = new Date();
    if (!product.batches.length)
      return (await this.enqueue([this.candidate(product, null, now)])) > 0;
    let after: string | undefined;
    let count = 0;
    while (true) {
      const batches = await this.prisma.productBatch.findMany({
        where: {
          companyId,
          productId,
          quantityAvailable: { gt: 0 },
          expirationDate: { not: null },
          ...(after ? { id: { gt: after } } : {}),
        },
        orderBy: { id: "asc" },
        take: PAGE_SIZE,
      });
      count += await this.enqueue(
        batches.map((batch) => this.candidate(product, batch, now)),
      );
      if (batches.length < PAGE_SIZE) break;
      after = batches.at(-1)!.id;
    }
    return count > 0;
  }

  async inspectProduct(companyId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: productSelect,
    });
    if (!product) throw new NotFoundException("Producto no encontrado");
    const now = new Date();
    const where = { companyId, productId, quantityAvailable: { gt: 0 } };
    const [batches, totalBatches] = product.batches.length
      ? await Promise.all([
          this.prisma.productBatch.findMany({
            where,
            orderBy: [
              { expirationDate: { sort: "asc", nulls: "last" } },
              { id: "asc" },
            ],
            take: 100,
          }),
          this.prisma.productBatch.count({ where }),
        ])
      : [[], 0];
    const candidates = product.batches.length
      ? batches.map((batch) => this.candidate(product, batch, now))
      : [this.candidate(product, null, now)];
    return {
      checkedAt: now.toISOString(),
      timeZone: companyTimeZone(product.company.timezone),
      profile: product.expiryProfile,
      warningDays:
        product.expiryProfile === "PERISHABLE"
          ? 3
          : product.expiryProfile === "STANDARD"
            ? 30
            : product.expiryWarningDays,
      warningMonths: product.expiryProfile === "LONG_LIFE" ? 3 : null,
      monitored:
        product.isActive &&
        !product.deletedAt &&
        product.stockQuantity.gt(0) &&
        ["ACTIVE", "TRIAL"].includes(product.company.status),
      totalBatches,
      truncated: totalBatches > batches.length,
      sources: candidates.map((candidate) => ({
        batchId: candidate.batchId,
        batchNumber: candidate.batchNumber,
        quantity: candidate.quantity.toString(),
        ...candidate.state,
      })),
    };
  }

  private candidate(
    product: ExpiryProduct,
    batch: {
      id: string;
      batchNumber: string;
      quantityAvailable: Prisma.Decimal;
      expirationDate: Date | null;
    } | null,
    now: Date,
  ): Candidate {
    return {
      product,
      batchId: batch?.id ?? null,
      batchNumber: batch?.batchNumber ?? null,
      quantity: batch?.quantityAvailable ?? product.stockQuantity,
      state: expiryState(
        product,
        batch ? batch.expirationDate : product.expiryDate,
        product.company.timezone,
        now,
      ),
    };
  }

  private async enqueue(candidates: Candidate[]): Promise<number> {
    const due = candidates.filter(
      (candidate) =>
        candidate.state.stage &&
        candidate.state.dateKey &&
        candidate.state.reminderKey,
    );
    if (!due.length) return 0;
    const memberships = await this.prisma.membership.findMany({
      where: {
        companyId: {
          in: [...new Set(due.map((candidate) => candidate.product.companyId))],
        },
        isActive: true,
        role: { in: ["COMPANY_ADMIN", "MANAGER"] },
        notificationStock: true,
        user: { isActive: true },
        company: { status: { in: ["ACTIVE", "TRIAL"] } },
      },
      select: { id: true, companyId: true },
    });
    const rows: Prisma.ProductExpiryAlertCreateManyInput[] = due.flatMap(
      (candidate) =>
        memberships
          .filter(
            (membership) =>
              membership.companyId === candidate.product.companyId,
          )
          .map((membership) => {
            const { state } = candidate;
            return {
              id: randomUUID(),
              eventKey: createHash("sha256")
                .update(
                  JSON.stringify([
                    membership.companyId,
                    membership.id,
                    candidate.product.id,
                    candidate.batchId,
                    state.dateKey,
                    state.stage,
                    state.reminderKey,
                  ]),
                )
                .digest("hex"),
              companyId: membership.companyId,
              membershipId: membership.id,
              productId: candidate.product.id,
              batchId: candidate.batchId,
              expiryDateKey: state.dateKey!,
              stage: state.stage!,
              reminderKey: state.reminderKey!,
            };
          }),
    );
    let count = 0;
    for (let offset = 0; offset < rows.length; offset += PAGE_SIZE) {
      const group = rows.slice(offset, offset + PAGE_SIZE);
      const existing = await this.prisma.productExpiryAlert.findMany({
        where: { eventKey: { in: group.map((row) => row.eventKey) } },
        select: { eventKey: true },
      });
      const keys = new Set(existing.map((row) => row.eventKey));
      const fresh = group.filter((row) => !keys.has(row.eventKey));
      if (!fresh.length) continue;
      count += await this.prisma.$transaction(async (tx) => {
        await tx.productExpiryAlert.createMany({
          data: fresh,
          skipDuplicates: true,
        });
        const inserted = await tx.productExpiryAlert.findMany({
          where: { id: { in: fresh.map((row) => row.id) } },
          select: { id: true },
        });
        if (inserted.length)
          await tx.outboxEvent.createMany({
            data: inserted.map((row) => ({
              kind: "PRODUCT_EXPIRY_ALERT",
              aggregateId: row.id,
              dedupeKey: `PRODUCT_EXPIRY_ALERT:${row.id}`,
            })),
            skipDuplicates: true,
          });
        return inserted.length;
      });
    }
    return count;
  }

  async deliver(id: string): Promise<void> {
    const alert = await this.prisma.productExpiryAlert.findUnique({
      where: { id },
      include: {
        product: { select: productSelect },
        membership: {
          select: {
            companyId: true,
            userId: true,
            isActive: true,
            role: true,
            notificationStock: true,
            user: { select: { isActive: true } },
          },
        },
      },
    });
    if (!alert) return;
    const { product, membership } = alert;
    if (
      product.companyId !== alert.companyId ||
      membership.companyId !== alert.companyId ||
      !membership.isActive ||
      !membership.user.isActive ||
      !membership.notificationStock ||
      !["COMPANY_ADMIN", "MANAGER"].includes(membership.role) ||
      !product.isActive ||
      product.deletedAt ||
      !product.stockQuantity.gt(0) ||
      !["ACTIVE", "TRIAL"].includes(product.company.status)
    )
      return;
    const batch = alert.batchId
      ? await this.prisma.productBatch.findFirst({
          where: {
            id: alert.batchId,
            productId: alert.productId,
            companyId: alert.companyId,
            quantityAvailable: { gt: 0 },
          },
        })
      : null;
    if ((alert.batchId && !batch) || (!alert.batchId && product.batches.length))
      return;
    const candidate = this.candidate(product, batch, new Date());
    const { state } = candidate;
    if (
      state.dateKey !== alert.expiryDateKey ||
      state.stage !== alert.stage ||
      state.reminderKey !== alert.reminderKey
    )
      return;
    const name = `"${product.name}"${batch ? ` (lote ${batch.batchNumber})` : ""}`;
    const days = state.daysLeft!;
    const timing =
      days < 0
        ? `venció hace ${Math.abs(days)} día(s)`
        : days === 0
          ? "vence hoy"
          : `vence en ${days} día(s)`;
    await this.notifications.create({
      userId: membership.userId,
      companyId: alert.companyId,
      type: days < 0 ? "PRODUCT_EXPIRED" : "PRODUCT_EXPIRING_SOON",
      title:
        days < 0
          ? "Producto vencido"
          : days === 0
            ? "Producto vence hoy"
            : "Producto por vencer",
      message: `El producto ${name} ${timing} (${state.dateKey}). Quedan ${candidate.quantity.toString()} ${product.baseUnit}. Revisa las existencias y su vigencia.`,
      actionUrl: `/products/${encodeURIComponent(product.id)}`,
      dedupeKey: `product-expiry:${alert.id}`,
      data: {
        productId: product.id,
        batchId: alert.batchId,
        batchNumber: batch?.batchNumber ?? null,
        expiryDate: state.dateKey,
        daysLeft: days,
        stage: state.stage,
        warningStartsOn: state.warningStartsOn,
        quantity: candidate.quantity.toString(),
        expiryAlertId: alert.id,
      },
    });
  }
}
