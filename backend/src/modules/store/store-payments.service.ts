import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Interval } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { IncomingHttpHeaders } from "node:http";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { StoreCryptoService } from "./store-crypto.service";
import { StoreOrdersService } from "./store-orders.service";
import { StoreActor } from "./store.strategy";
import { StoreIntegrationDto } from "./dto/store-order.dto";
import { storeSnapshotSchema } from "./store-pricing";
import { gatewayRecord, storeRedirect, storeWebhookId } from "./store-gateway";

@Injectable()
export class StorePaymentsService {
  private readonly logger = new Logger(StorePaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: StoreCryptoService,
    private readonly orders: StoreOrdersService,
    private readonly config: ConfigService,
  ) {}
  private async request(
    token: string,
    path: string,
    body?: object,
    key?: string,
  ) {
    const response = await fetch(`https://api.mercadopago.com${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(key ? { "X-Idempotency-Key": key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok)
      throw new BadGatewayException("El proveedor de pago no está disponible");
    return gatewayRecord(await response.json());
  }
  async integration(companyId: string) {
    const integration = await this.prisma.storePaymentIntegration.findUnique({
      where: { companyId },
    });
    return integration
      ? {
          configured: true,
          enabled: integration.enabled,
          merchantId: integration.merchantId,
          liveMode: integration.liveMode,
          webhookUrl: `${this.config.getOrThrow<string>("FRONTEND_URL").replace(/\/$/, "")}/api/store-payments/webhooks/${integration.publicId}`,
        }
      : { configured: false };
  }
  async configure(companyId: string, input: StoreIntegrationDto) {
    const merchant = await this.request(input.accessToken, "/users/me");
    if (!merchant.id || !/^\d+$/.test(String(merchant.id)))
      throw new BadGatewayException(
        "No se pudo verificar el comercio receptor",
      );
    const old = await this.prisma.storePaymentIntegration.findUnique({
      where: { companyId },
    });
    if (
      old &&
      (old.merchantId !== String(merchant.id) ||
        old.liveMode !== input.liveMode) &&
      (await this.prisma.storePaymentAttempt.count({ where: { companyId } }))
    )
      throw new ConflictException(
        "No cambies el comercio o entorno de una integración con pagos históricos",
      );
    const data = {
      encryptedToken: this.crypto.encrypt(input.accessToken),
      encryptedWebhookSecret: this.crypto.encrypt(input.webhookSecret),
      merchantId: String(merchant.id),
      liveMode: input.liveMode,
      enabled: input.enabled,
    };
    await this.prisma.storePaymentIntegration.upsert({
      where: { companyId },
      create: { companyId, ...data },
      update: data,
    });
    return this.integration(companyId);
  }
  async start(actor: StoreActor, id: string) {
    const order = await this.prisma.storeOrder.findFirst({
      where: { id, companyId: actor.companyId, accountId: actor.accountId },
    });
    if (!order) throw new NotFoundException();
    if (
      order.expiresAt <= new Date() ||
      order.paymentStatus === "PAID" ||
      order.status !== "PENDING_PAYMENT" ||
      storeSnapshotSchema.parse(order.snapshot).payment.code !== "MERCADOPAGO"
    )
      throw new BadRequestException("El pedido no permite iniciar un pago");
    if (
      !(await this.prisma.storePaymentIntegration.findFirst({
        where: { companyId: actor.companyId, enabled: true },
      }))
    )
      throw new BadRequestException("La pasarela no está configurada");
    const attempt = await this.prisma.storePaymentAttempt.upsert({
      where: { orderId: id },
      create: { companyId: actor.companyId, orderId: id },
      update: {},
    });
    await this.preference(attempt.id);
    const updated = await this.prisma.storePaymentAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    });
    return {
      status: updated.status,
      redirectUrl: updated.redirectUrl
        ? storeRedirect(updated.redirectUrl)
        : null,
      message: updated.redirectUrl
        ? "Continúa en el proveedor"
        : "Preparando pago. Puedes reintentar sin crear otro pedido.",
    };
  }
  private async preference(id: string) {
    const attempt = await this.prisma.storePaymentAttempt.findUniqueOrThrow({
      where: { id },
      include: {
        order: { include: { account: { include: { company: true } } } },
        integration: true,
      },
    });
    if (
      attempt.redirectUrl ||
      !attempt.integration.enabled ||
      attempt.order.expiresAt <= new Date()
    )
      return;
    const now = new Date();
    const leaseUntil = new Date(Date.now() + 60000);
    const claimed = await this.prisma.storePaymentAttempt.updateMany({
      where: {
        id,
        redirectUrl: null,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      },
      data: { leaseUntil },
    });
    if (!claimed.count) return;
    try {
      const base = this.config
        .getOrThrow<string>("FRONTEND_URL")
        .replace(/\/$/, "");
      const returnUrl = `${base}/tienda/${encodeURIComponent(attempt.order.account.company.slug)}/pedidos/${attempt.orderId}`;
      const data = await this.request(
        this.crypto.decrypt(attempt.integration.encryptedToken),
        "/checkout/preferences",
        {
          items: [
            {
              id: attempt.orderId,
              title: `Pedido ${attempt.order.number}`,
              quantity: 1,
              unit_price: Number(attempt.order.totalAmount),
              currency_id: "PEN",
            },
          ],
          external_reference: attempt.id,
          notification_url: `${base}/api/store-payments/webhooks/${attempt.integration.publicId}`,
          back_urls: {
            success: returnUrl,
            pending: returnUrl,
            failure: returnUrl,
          },
          expires: true,
          expiration_date_to: attempt.order.expiresAt.toISOString(),
        },
        attempt.id,
      );
      const redirectUrl = storeRedirect(
        attempt.integration.liveMode
          ? data.init_point
          : data.sandbox_init_point,
      );
      if (typeof data.id !== "string")
        throw new BadGatewayException("Preferencia incompleta");
      await this.prisma.storePaymentAttempt.updateMany({
        where: { id, leaseUntil },
        data: { preferenceId: data.id, redirectUrl, leaseUntil: null },
      });
    } catch {
      this.logger.warn(`Se reintentará la preferencia comercial ${id}`);
    }
  }
  async webhook(
    publicId: string,
    headers: IncomingHttpHeaders,
    query: Record<string, unknown>,
  ) {
    const integration = await this.prisma.storePaymentIntegration.findUnique({
      where: { publicId },
    });
    if (!integration) throw new NotFoundException();
    const id = storeWebhookId(
      this.crypto.decrypt(integration.encryptedWebhookSecret),
      headers,
      query,
    );
    await this.reconcile(integration.companyId, id);
    return { received: true };
  }
  async reconcile(companyId: string, id: string) {
    if (!/^\d{1,128}$/.test(id)) throw new BadRequestException("Pago inválido");
    const integration =
      await this.prisma.storePaymentIntegration.findUniqueOrThrow({
        where: { companyId },
      });
    const payment = await this.request(
      this.crypto.decrypt(integration.encryptedToken),
      `/v1/payments/${id}`,
    );
    if (
      String(payment.id) !== id ||
      String(payment.collector_id) !== integration.merchantId ||
      payment.live_mode !== integration.liveMode ||
      payment.currency_id !== "PEN" ||
      typeof payment.transaction_amount !== "number" ||
      !Number.isFinite(payment.transaction_amount) ||
      typeof payment.external_reference !== "string" ||
      typeof payment.status !== "string"
    )
      throw new BadRequestException(
        "El pago no corresponde a esta integración",
      );
    const attempt = await this.prisma.storePaymentAttempt.findFirst({
      where: { companyId, id: payment.external_reference },
      include: { order: true },
    });
    if (!attempt)
      throw new NotFoundException("Referencia de pago no encontrada");
    const amount = new Prisma.Decimal(payment.transaction_amount);
    const refunded =
      typeof payment.transaction_amount_refunded === "number"
        ? new Prisma.Decimal(payment.transaction_amount_refunded)
        : new Prisma.Decimal(0);
    const eventKey = `${payment.status}:${amount.toFixed(2)}:${refunded.toFixed(2)}`;
    await serializableTransaction(this.prisma, async (tx) => {
      const order = await this.orders.lock(tx, companyId, attempt.orderId);
      const eventWhere = {
        companyId_providerPaymentId_eventKey: {
          companyId,
          providerPaymentId: id,
          eventKey,
        },
      };
      if (await tx.storePaymentEvent.findUnique({ where: eventWhere })) return;
      const mismatch =
        !amount.eq(order.totalAmount) ||
        (!!attempt.providerPaymentId && attempt.providerPaymentId !== id);
      await tx.storePaymentEvent.create({
        data: {
          companyId,
          providerPaymentId: id,
          eventKey,
          requiresReview:
            mismatch || (refunded.gt(0) && refunded.lt(order.totalAmount)),
          detail: {
            orderId: order.id,
            status: payment.status as string,
            amount: amount.toString(),
            refunded: refunded.toString(),
          },
        },
      });
      if (mismatch) {
        await this.orders.note(
          tx,
          order,
          "Recibimos una incidencia de pago que requiere conciliación del negocio.",
        );
        return;
      }
      if (order.paymentStatus === "REFUNDED") return;
      if (payment.status === "approved") {
        await tx.storePaymentAttempt.update({
          where: { id: attempt.id },
          data: { status: "PAID", providerPaymentId: id },
        });
        await this.orders.settle(tx, companyId, order.id, `MERCADOPAGO:${id}`);
      } else if (
        payment.status === "refunded" &&
        refunded.gte(order.totalAmount)
      ) {
        await this.orders.markRefund(
          tx,
          companyId,
          order.id,
          `MERCADOPAGO:${id}`,
          undefined,
          true,
        );
        await tx.storePaymentAttempt.update({
          where: { id: attempt.id },
          data: { status: "REFUNDED", providerPaymentId: id },
        });
      } else if (!["PAID", "REFUNDED"].includes(attempt.status))
        await tx.storePaymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status:
              payment.status === "rejected" || payment.status === "cancelled"
                ? "FAILED"
                : "PENDING",
            providerPaymentId: id,
          },
        });
    });
  }
  async refund(
    companyId: string,
    id: string,
    reference: string,
    userId: string,
  ) {
    if (reference.trim().length < 5)
      throw new BadRequestException("Indica la referencia de devolución");
    const order = await this.prisma.storeOrder.findFirst({
      where: { id, companyId },
    });
    if (!order) throw new NotFoundException();
    if (order.paymentStatus === "REFUNDED")
      return this.orders.get(companyId, id);
    if (order.paymentStatus !== "PAID")
      throw new BadRequestException("No hay cobro confirmado");
    if (
      storeSnapshotSchema.parse(order.snapshot).payment.code === "MERCADOPAGO"
    ) {
      const attempt = await this.prisma.storePaymentAttempt.findUniqueOrThrow({
        where: { orderId: id },
        include: { integration: true },
      });
      if (!attempt.providerPaymentId)
        throw new BadRequestException("Pago sin referencia verificada");
      const refund = await this.prisma.storeRefund.upsert({
        where: { orderId: id },
        create: { companyId, orderId: id, amount: order.totalAmount },
        update: {},
      });
      await this.request(
        this.crypto.decrypt(attempt.integration.encryptedToken),
        `/v1/payments/${attempt.providerPaymentId}/refunds`,
        {},
        refund.id,
      );
      await this.reconcile(companyId, attempt.providerPaymentId);
    } else
      await serializableTransaction(this.prisma, (tx) =>
        this.orders.markRefund(tx, companyId, id, reference, userId),
      );
    return this.orders.get(companyId, id);
  }
  @Interval(60000)
  async recover() {
    try {
      const attempts = await this.prisma.storePaymentAttempt.findMany({
        where: {
          OR: [
            { status: "PENDING", order: { status: "PENDING_PAYMENT" } },
            { status: "PAID", order: { refund: { status: "PENDING" } } },
          ],
          AND: {
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
          },
        },
        orderBy: { id: "asc" },
        take: 5,
        include: { integration: true },
      });
      for (const attempt of attempts) {
        try {
          if (!attempt.redirectUrl && !attempt.providerPaymentId) {
            await this.preference(attempt.id);
            continue;
          }
          const leaseUntil = new Date(Date.now() + 300000);
          const claimed = await this.prisma.storePaymentAttempt.updateMany({
            where: {
              id: attempt.id,
              OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
            },
            data: { leaseUntil },
          });
          if (!claimed.count) continue;
          if (attempt.providerPaymentId)
            await this.reconcile(attempt.companyId, attempt.providerPaymentId);
          else {
            const data = await this.request(
              this.crypto.decrypt(attempt.integration.encryptedToken),
              `/v1/payments/search?external_reference=${encodeURIComponent(attempt.id)}&sort=date_created&criteria=desc&limit=5`,
            );
            if (Array.isArray(data.results))
              for (const value of data.results.slice(0, 5)) {
                const payment = gatewayRecord(value);
                if (/^\d+$/.test(String(payment.id)))
                  await this.reconcile(attempt.companyId, String(payment.id));
              }
          }
        } catch {
          this.logger.warn(`Conciliación comercial pendiente ${attempt.id}`);
        }
      }
    } catch {
      this.logger.warn("Se reintentará la recuperación de pagos comerciales");
    }
  }
}
