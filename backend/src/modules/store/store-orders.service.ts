import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import {
  Prisma,
  StoreOrder,
  PaymentProvider,
  AuditAction,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { parseImageDataUrl } from "@/common/helpers/image.helper";
import { companyTimeZone } from "@/common/helpers/company-timezone.helper";
import { AuditService } from "@/common/services/audit.service";
import { KardexService } from "@/modules/kardex/kardex.service";
import { enqueueDomainEffect } from "@/modules/outbox/outbox-event.helper";
import { StoreActor } from "./store.strategy";
import { StoreService } from "./store.service";
import { StoreStockService } from "./store-stock.service";
import { StoreCryptoService, storeHash } from "./store-crypto.service";
import { StoreMailService } from "./store-mail.service";
import { StoreAdminPolicyService } from "./admin/store-admin-policy.service";
import { storeSnapshotSchema } from "./store-pricing";
import {
  StoreCreateOrderDto,
  StoreOrderActionDto,
} from "./dto/store-order.dto";

@Injectable()
export class StoreOrdersService {
  private readonly logger = new Logger(StoreOrdersService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly store: StoreService,
    private readonly stock: StoreStockService,
    private readonly crypto: StoreCryptoService,
    private readonly mail: StoreMailService,
    private readonly kardex: KardexService,
    private readonly audit: AuditService,
    private readonly policy: StoreAdminPolicyService,
  ) {}

  async lock(tx: Prisma.TransactionClient, companyId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM store_orders WHERE id = ${id} AND company_id = ${companyId} FOR UPDATE`;
    const order = await tx.storeOrder.findFirst({
      where: { id, companyId },
      include: {
        refund: { select: { status: true, restockedAt: true } },
        reservations: { select: { state: true, expiresAt: true } },
      },
    });
    if (!order) throw new NotFoundException("Pedido no encontrado");
    return order;
  }
  async note(
    tx: Prisma.TransactionClient,
    order: StoreOrder,
    message: string,
    userId?: string,
  ) {
    const updated = await tx.storeOrder.update({
      where: { id: order.id },
      data: { version: { increment: 1 } },
    });
    await tx.storeOrderHistory.create({
      data: {
        companyId: order.companyId,
        orderId: order.id,
        version: updated.version,
        actorId: userId ?? "system",
        message,
      },
    });
    await tx.storeNotification.create({
      data: {
        companyId: order.companyId,
        accountId: order.accountId,
        orderId: order.id,
        version: updated.version,
        message,
      },
    });
    const owners = await tx.membership.findMany({
      where: {
        companyId: order.companyId,
        role: "COMPANY_ADMIN",
        isActive: true,
        user: { isActive: true },
      },
      select: { id: true, userId: true, user: { select: { email: true } } },
    });
    if (owners.length) {
      const notices = await tx.notification.createManyAndReturn({
        data: owners.map((owner) => ({
          companyId: order.companyId,
          userId: owner.userId,
          type: "SYSTEM" as const,
          title: `Pedido ${order.number}`,
          message,
          actionUrl: `/comercio/pedidos/${order.id}`,
          scope: "COMPANY",
          dedupeKey: `STORE:${order.id}:${updated.version}:${owner.id}`,
        })),
        skipDuplicates: true,
        select: { id: true },
      });
      await tx.outboxEvent.createMany({
        data: notices.map((notice) => ({
          dedupeKey: `STORE_ORDER_NOTIFICATION:${notice.id}`,
          kind: "STORE_ORDER_NOTIFICATION",
          aggregateId: notice.id,
        })),
        skipDuplicates: true,
      });
      for (const owner of owners) {
        await this.mail.enqueue(
          tx,
          owner.user.email,
          `Pedido ${order.number}`,
          `${message}\nPedido: ${order.number}\nAbre la sección Tienda para revisar la compra y su forma de entrega.`,
        );
      }
    }
    const account = await tx.customerAccount.findUniqueOrThrow({
      where: { id: order.accountId },
      select: {
        user: { select: { email: true } },
        company: { select: { slug: true } },
      },
    });
    await this.mail.enqueue(
      tx,
      account.user.email,
      `Pedido ${order.number}`,
      `${message}\nPedido: ${order.number}\nRevisa tu pedido: ${this.mail.orderUrl(account.company.slug, order.id)}`,
    );
    await this.audit.log(
      {
        companyId: order.companyId,
        userId,
        action: AuditAction.UPDATE,
        entity: "StoreOrder",
        entityId: order.id,
        changes: {
          message,
          version: updated.version,
          status: updated.status,
          paymentStatus: updated.paymentStatus,
        },
      },
      tx,
    );
    return updated;
  }
  async create(slug: string, actor: StoreActor, input: StoreCreateOrderDto) {
    const company = await this.store.company(slug);
    const fingerprint = storeHash(input.quoteId);
    const id = await serializableTransaction(
      this.prisma,
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM customer_accounts WHERE id = ${actor.accountId} FOR UPDATE`;
        const old = await tx.storeOrder.findUnique({
          where: {
            companyId_accountId_idempotencyKey: {
              companyId: actor.companyId,
              accountId: actor.accountId,
              idempotencyKey: input.idempotencyKey,
            },
          },
        });
        if (old) {
          if (old.fingerprint !== fingerprint)
            throw new ConflictException("La clave ya pertenece a otro pedido");
          return old.id;
        }
        const recovered = await tx.storeOrder.findFirst({
          where: {
            companyId: actor.companyId,
            accountId: actor.accountId,
            quoteId: input.quoteId,
          },
          select: { id: true },
        });
        if (recovered) return recovered.id;
        await tx.$queryRaw`SELECT company_id FROM storefront_settings WHERE company_id = ${actor.companyId} FOR UPDATE`;
        const settings = await tx.storefrontSettings.findUniqueOrThrow({
          where: { companyId: actor.companyId },
        });
        const quote = await tx.storeQuote.findFirst({
          where: {
            id: input.quoteId,
            companyId: actor.companyId,
            accountId: actor.accountId,
            expiresAt: { gt: new Date() },
          },
        });
        if (
          !settings.enabled ||
          !settings.checkoutEnabled ||
          !quote ||
          quote.settingsVersion !== settings.version
        )
          throw new ConflictException(
            "Cotización vencida o tienda modificada. Calcula nuevamente.",
          );
        if (
          (await tx.storeOrder.count({
            where: {
              accountId: actor.accountId,
              saleId: null,
              status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
            },
          })) >= 3
        )
          throw new BadRequestException(
            "Resuelve tus pedidos pendientes antes de reservar más productos",
          );
        const snapshot = storeSnapshotSchema.parse(quote.snapshot);
        if (
          snapshot.payment.code === "MERCADOPAGO" &&
          !(await tx.storePaymentIntegration.findFirst({
            where: { companyId: actor.companyId, enabled: true },
          }))
        )
          throw new BadRequestException("La pasarela no está configurada");
        const products = await tx.product.findMany({
          where: {
            companyId: actor.companyId,
            id: { in: snapshot.lines.map((line) => line.productId) },
            storeVisible: true,
            deletedAt: null,
            isActive: true,
          },
          include: { presentations: true },
        });
        for (const line of snapshot.lines) {
          const product = products.find((p) => p.id === line.productId);
          const presentation = line.presentationId
            ? product?.presentations.find(
                (p) => p.id === line.presentationId && p.isActive,
              )
            : null;
          if (!product || (line.presentationId && !presentation))
            throw new ConflictException(
              "Un producto cambió. Revisa el carrito.",
            );
          const factor = presentation?.factor ?? new Prisma.Decimal(1);
          const gross = presentation?.price ?? product.salePrice.mul(factor);
          const net = settings.pricesIncludeTax
            ? gross.div(settings.taxRate.div(100).plus(1))
            : gross;
          if (
            !factor.eq(line.factor) ||
            !net.toDecimalPlaces(4).eq(line.unitPrice)
          )
            throw new ConflictException(
              "El precio o presentación cambió. Calcula nuevamente.",
            );
        }
        const cart = await tx.storeCart.updateMany({
          where: {
            companyId: actor.companyId,
            accountId: actor.accountId,
            version: quote.cartVersion,
          },
          data: { version: { increment: 1 } },
        });
        if (!cart.count) throw new ConflictException("El carrito cambió");
        const orderId = randomUUID();
        const expiresAt = new Date(
          Date.now() + settings.reservationMinutes * 60000,
        );
        const order = await tx.storeOrder.create({
          data: {
            id: orderId,
            companyId: actor.companyId,
            accountId: actor.accountId,
            quoteId: quote.id,
            idempotencyKey: input.idempotencyKey,
            fingerprint,
            number: `WEB-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 8).toUpperCase()}`,
            expiresAt,
            snapshot,
            totalAmount: snapshot.totalAmount,
          },
        });
        await this.stock.hold(
          tx,
          company.id,
          order.id,
          snapshot.lines,
          expiresAt,
        );
        await tx.storeCartItem.deleteMany({
          where: {
            cart: { companyId: actor.companyId, accountId: actor.accountId },
          },
        });
        await this.note(
          tx,
          order,
          "Pedido recibido. Completa el pago o coordina tu retiro dentro del plazo.",
          actor.sub,
        );
        return order.id;
      },
      { timeout: 30000 },
    );
    return this.get(actor.companyId, id, actor.accountId);
  }
  async get(companyId: string, id: string, accountId?: string) {
    const order = await this.prisma.storeOrder.findFirst({
      where: { id, companyId, ...(accountId ? { accountId } : {}) },
      include: {
        history: {
          select: { message: true, version: true, createdAt: true },
          orderBy: { version: "desc" },
          take: 100,
        },
        proofs: { select: { id: true, createdAt: true } },
        attempt: { select: { status: true, redirectUrl: true } },
        refund: { select: { status: true, amount: true, restockedAt: true } },
        reservations: { select: { state: true, expiresAt: true } },
      },
    });
    if (!order) throw new NotFoundException("Pedido no encontrado");
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillment: order.fulfillment,
      version: order.version,
      totalAmount: order.totalAmount.toString(),
      snapshot: storeSnapshotSchema.parse(order.snapshot),
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      trackingCode: order.trackingCode,
      saleId: order.saleId,
      history: [...order.history].reverse(),
      proofs: order.proofs,
      payment: order.attempt,
      refund: order.refund,
      refundRequestedAt: order.refundRequestedAt,
      ...(accountId
        ? {}
        : {
            refundReason: order.refundReason,
            allowedActions: this.policy.allowedActions(order),
            actionAvailability: this.policy.actionAvailability(order),
          }),
    };
  }
  async list(companyId: string, page = 1, accountId?: string) {
    return this.prisma.storeOrder.findMany({
      where: { companyId, ...(accountId ? { accountId } : {}) },
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        fulfillment: true,
        totalAmount: true,
        createdAt: true,
        version: true,
        refundRequestedAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
      skip: (page - 1) * 30,
    });
  }
  async notificationFeed(companyId: string, accountId: string) {
    const where = { companyId, accountId };
    const [data, unreadCount] = await Promise.all([
      this.prisma.storeNotification.findMany({
        where,
        select: {
          id: true,
          orderId: true,
          version: true,
          message: true,
          readAt: true,
          createdAt: true,
          order: { select: { number: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      }),
      this.prisma.storeNotification.count({
        where: { ...where, readAt: null },
      }),
    ]);
    return { accountId, data, unreadCount };
  }
  async settle(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
    reference: string,
    userId?: string,
  ) {
    const order = await this.lock(tx, companyId, id);
    if (["PAID", "REFUNDED"].includes(order.paymentStatus) || order.saleId)
      return order;
    const snapshot = storeSnapshotSchema.parse(order.snapshot);
    if (
      order.status === "CANCELLED" ||
      order.status === "EXPIRED" ||
      order.expiresAt <= new Date() ||
      !(await this.stock.consume(tx, companyId, id))
    ) {
      await this.stock.release(tx, companyId, id, true);
      await tx.storeOrder.update({
        where: { id },
        data: {
          status: "REVIEW_REQUIRED",
          paymentStatus: "PAID",
          paymentReference: reference,
        },
      });
      return this.note(
        tx,
        order,
        "Pago recibido fuera de la reserva. El negocio debe conciliar disponibilidad o devolver el importe.",
        userId,
      );
    }
    const account = await tx.customerAccount.findUniqueOrThrow({
      where: { id: order.accountId },
    });
    const method: PaymentProvider =
      snapshot.payment.code === "CASH_ON_PICKUP"
        ? "CASH"
        : snapshot.payment.code === "MERCADOPAGO"
          ? "MERCADOPAGO"
          : snapshot.payment.code === "YAPE"
            ? "YAPE"
            : snapshot.payment.code === "PLIN"
              ? "PLIN"
              : "TRANSFER";
    const sale = await tx.sale.create({
      data: {
        companyId,
        customerId: account.customerId,
        sellerId: null,
        channel: "ONLINE",
        saleNumber: order.number,
        status: "COMPLETED",
        subtotal: snapshot.subtotal,
        taxAmount: snapshot.taxAmount,
        shippingAmount: snapshot.shippingAmount,
        totalAmount: snapshot.totalAmount,
        paymentMethod: method,
        paidAmount: snapshot.totalAmount,
        changeAmount: 0,
        notes: `Pedido comercial ${order.id}`,
        items: {
          create: snapshot.lines.map((line) => ({
            productId: line.productId,
            presentationId: line.presentationId,
            quantity: line.quantity,
            unitFactor: line.factor,
            baseQuantity: line.baseQuantity,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
          })),
        },
      },
    });
    for (const line of snapshot.lines) {
      const quantity = new Prisma.Decimal(line.baseQuantity);
      const movement = await tx.inventoryMovement.create({
        data: {
          companyId,
          productId: line.productId,
          presentationId: line.presentationId,
          type: "OUT",
          quantity: quantity.neg(),
          notes: `Pedido ${order.number}`,
        },
      });
      const costs = await this.kardex.recordOutMovement(
        companyId,
        line.productId,
        quantity,
        movement.id,
        tx,
      );
      await tx.saleItem.updateMany({
        where: { saleId: sale.id, productId: line.productId },
        data: { unitCostSnapshot: costs.unitCost },
      });
    }
    await tx.storeOrder.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "PAID",
        paymentReference: reference,
        saleId: sale.id,
      },
    });
    await enqueueDomainEffect(tx, "SALE_COMMITTED", sale.id);
    return this.note(
      tx,
      order,
      `Pago aceptado y confirmado. Tu pedido fue confirmado. ${{ UNFULFILLED: "Continuaremos con su preparación.", PREPARING: "Tu pedido sigue en preparación.", READY_FOR_PICKUP: "Tu pedido está listo para recoger.", SHIPPED: "Tu pedido ya fue despachado.", DELIVERED: "La entrega de tu pedido ya fue registrada." }[order.fulfillment] ?? "Revisa el estado de entrega de tu pedido."}`,
      userId,
    );
  }
  async cancel(
    companyId: string,
    id: string,
    userId?: string,
    accountId?: string,
    expired = false,
    expectedVersion?: number,
    reason?: string,
  ) {
    await serializableTransaction(this.prisma, async (tx) => {
      const order = await this.lock(tx, companyId, id);
      if (accountId && order.accountId !== accountId)
        throw new NotFoundException();
      if (expectedVersion !== undefined && order.version !== expectedVersion)
        throw new ConflictException("El pedido cambió. Actualiza el detalle.");
      if (["CANCELLED", "EXPIRED"].includes(order.status)) return;
      if (order.saleId || order.paymentStatus === "PAID")
        throw new BadRequestException(
          "El pedido pagado requiere devolución, no cancelación directa",
        );
      if (!expired) this.policy.assertAllowedAction(order, "CANCEL");
      await this.stock.release(tx, companyId, id, expired);
      await tx.storeOrder.update({
        where: { id },
        data: {
          status: expired ? "EXPIRED" : "CANCELLED",
          fulfillment: "CANCELLED",
        },
      });
      await this.note(
        tx,
        order,
        expired
          ? "Venció el plazo del pedido y liberamos la reserva."
          : accountId
            ? "Cancelaste tu pedido. La reserva fue liberada."
            : `El negocio canceló tu pedido. ${reason ? `Motivo: ${reason}. ` : ""}La reserva fue liberada.`,
        userId,
      );
    });
    return this.get(companyId, id, accountId);
  }
  async proof(actor: StoreActor, id: string, raw: string) {
    const image = await parseImageDataUrl(raw);
    await serializableTransaction(this.prisma, async (tx) => {
      const order = await this.lock(tx, actor.companyId, id);
      if (order.accountId !== actor.accountId) throw new NotFoundException();
      const snapshot = storeSnapshotSchema.parse(order.snapshot);
      if (
        !["TRANSFER", "YAPE", "PLIN"].includes(snapshot.payment.code) ||
        order.expiresAt <= new Date() ||
        ["PAID", "REFUNDED"].includes(order.paymentStatus) ||
        order.saleId ||
        ["EXPIRED", "CANCELLED", "COMPLETED"].includes(order.status)
      )
        throw new BadRequestException("El pedido no admite comprobantes");
      if ((await tx.storePaymentProof.count({ where: { orderId: id } })) >= 5)
        throw new BadRequestException("Límite de comprobantes alcanzado");
      await tx.storePaymentProof.create({
        data: {
          companyId: actor.companyId,
          orderId: id,
          encryptedImage: this.crypto.encrypt(image.dataUrl),
        },
      });
      await tx.storeOrder.update({
        where: { id },
        data: { paymentStatus: "UNDER_REVIEW" },
      });
      await this.note(
        tx,
        order,
        "Comprobante recibido. El negocio revisará el pago.",
        actor.sub,
      );
    });
    return this.get(actor.companyId, id, actor.accountId);
  }
  async action(
    companyId: string,
    id: string,
    input: StoreOrderActionDto,
    userId: string,
  ) {
    if (input.action === "CANCEL")
      return this.cancel(
        companyId,
        id,
        userId,
        undefined,
        false,
        input.version,
        input.reason,
      );
    await serializableTransaction(this.prisma, async (tx) => {
      const order = await this.lock(tx, companyId, id);
      if (order.version !== input.version)
        throw new ConflictException("El pedido cambió. Actualiza el detalle.");
      this.policy.assertAllowedAction(
        order,
        input.action as Parameters<
          StoreAdminPolicyService["assertAllowedAction"]
        >[1],
      );
      const snapshot = storeSnapshotSchema.parse(order.snapshot);
      if (input.action === "APPROVE_PAYMENT") {
        if (
          snapshot.payment.code === "MERCADOPAGO" ||
          !input.reference ||
          input.reference.trim().length < 5
        )
          throw new BadRequestException(
            "Indica la referencia real del cobro manual; la pasarela se verifica automáticamente",
          );
        await this.settle(tx, companyId, id, input.reference.trim(), userId);
        return;
      }
      if (input.action === "RESTOCK") {
        await this.restock(tx, order, userId);
        return;
      }
      if (input.action === "REJECT_PROOF") {
        if (order.paymentStatus !== "UNDER_REVIEW")
          throw new BadRequestException();
        await tx.storeOrder.update({
          where: { id },
          data: { paymentStatus: "REJECTED" },
        });
        await this.note(
          tx,
          order,
          `Comprobante de pago rechazado. ${input.reason ? `Motivo: ${input.reason}. ` : "No se pudo validar el comprobante recibido. "}${order.expiresAt > new Date() && !["CANCELLED", "EXPIRED"].includes(order.status) ? "Puedes enviar un nuevo comprobante dentro del plazo de tu reserva." : "La reserva ya no está vigente; contacta al negocio para coordinar tu pedido."}`,
          userId,
        );
        return;
      }
      if (input.action === "EXTEND") {
        if (
          order.saleId ||
          order.paymentStatus === "PAID" ||
          order.expiresAt <= new Date()
        )
          throw new BadRequestException(
            "Solo se puede extender una reserva vigente",
          );
        const settings = await tx.storefrontSettings.findUniqueOrThrow({
          where: { companyId },
          include: { company: { select: { timezone: true } } },
        });
        const expiresAt = new Date(
          Math.max(Date.now(), order.expiresAt.getTime()) +
            settings.reservationMinutes * 60000,
        );
        await tx.stockReservation.updateMany({
          where: { companyId, ownerId: id, state: "ACTIVE" },
          data: { expiresAt },
        });
        await tx.storeOrder.update({ where: { id }, data: { expiresAt } });
        await this.note(
          tx,
          order,
          `El negocio amplió tu reserva hasta ${expiresAt.toLocaleString("es-PE", { timeZone: companyTimeZone(settings.company.timezone) })} (${companyTimeZone(settings.company.timezone)}).`,
          userId,
        );
        return;
      }
      const cash =
        snapshot.payment.code === "CASH_ON_PICKUP" &&
        order.expiresAt > new Date();
      if (order.paymentStatus !== "PAID" && !cash)
        throw new BadRequestException("Primero confirma el pago");
      const transitions: Record<string, { from: string[]; to: string }> = {
        PREPARE: { from: ["UNFULFILLED"], to: "PREPARING" },
        READY: { from: ["PREPARING"], to: "READY_FOR_PICKUP" },
        SHIP: { from: ["PREPARING"], to: "SHIPPED" },
        DELIVER: { from: ["READY_FOR_PICKUP", "SHIPPED"], to: "DELIVERED" },
      };
      const transition = transitions[input.action];
      if (
        !transition ||
        !transition.from.includes(order.fulfillment) ||
        (input.action === "READY" && snapshot.shipping.kind !== "PICKUP") ||
        (input.action === "SHIP" &&
          (snapshot.shipping.kind !== "DELIVERY" || !input.reference?.trim()))
      )
        throw new BadRequestException("Transición de entrega inválida");
      if (input.action === "DELIVER" && order.paymentStatus !== "PAID")
        throw new BadRequestException(
          "Confirma el cobro del retiro antes de entregar",
        );
      await tx.storeOrder.update({
        where: { id },
        data: {
          fulfillment: transition.to,
          ...(input.action === "SHIP"
            ? { trackingCode: input.reference?.trim() }
            : {}),
          ...(input.action === "DELIVER" ? { status: "COMPLETED" } : {}),
        },
      });
      await this.note(
        tx,
        order,
        {
          PREPARE: "Estamos preparando tu pedido.",
          READY: `Tu pedido está listo para recoger.${snapshot.shipping.pickupAddress ? ` Dirección: ${snapshot.shipping.pickupAddress}.` : ""}`,
          SHIP: `Tu pedido fue despachado. Referencia de seguimiento: ${input.reference?.trim()}.`,
          DELIVER: "Pedido entregado. Gracias por tu compra.",
        }[input.action] ?? "Estado actualizado",
        userId,
      );
    });
    return this.get(companyId, id);
  }
  async requestRefund(actor: StoreActor, id: string, reason: string) {
    await serializableTransaction(this.prisma, async (tx) => {
      const order = await this.lock(tx, actor.companyId, id);
      if (order.accountId !== actor.accountId || order.paymentStatus !== "PAID")
        throw new NotFoundException();
      if (order.refundRequestedAt) return;
      await tx.storeOrder.update({
        where: { id },
        data: { refundRequestedAt: new Date(), refundReason: reason },
      });
      await this.note(
        tx,
        order,
        "Recibimos tu solicitud de devolución. El negocio la revisará.",
        actor.sub,
      );
    });
    return this.get(actor.companyId, id, actor.accountId);
  }
  async markRefund(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
    reference: string,
    userId?: string,
    providerConfirmed = false,
  ) {
    const order = await this.lock(tx, companyId, id);
    if (order.paymentStatus === "REFUNDED") return;
    if (order.paymentStatus !== "PAID" && !providerConfirmed)
      throw new BadRequestException("El pedido no tiene un cobro confirmado");
    await tx.storeRefund.upsert({
      where: { orderId: id },
      create: {
        companyId,
        orderId: id,
        status: "SUCCEEDED",
        amount: order.totalAmount,
        reference,
      },
      update: { status: "SUCCEEDED", reference },
    });
    if (order.saleId)
      await tx.sale.update({
        where: { id: order.saleId },
        data: { status: "REFUNDED" },
      });
    await this.stock.release(tx, companyId, id);
    await tx.storeOrder.update({
      where: { id },
      data: { status: "CANCELLED", paymentStatus: "REFUNDED" },
    });
    await this.note(
      tx,
      order,
      "Devolución total del pago confirmada. El reintegro físico de productos se gestiona por separado.",
      userId,
    );
  }
  private async restock(
    tx: Prisma.TransactionClient,
    order: StoreOrder,
    userId: string,
  ) {
    const refund = await tx.storeRefund.findUnique({
      where: { orderId: order.id },
    });
    if (!refund || refund.status !== "SUCCEEDED" || refund.restockedAt)
      throw new BadRequestException(
        "La devolución ya se repuso o el pago no fue devuelto",
      );
    const holds = await tx.stockReservation.findMany({
      where: {
        ownerId: order.id,
        companyId: order.companyId,
        state: "CONSUMED",
      },
      include: { allocations: true },
      orderBy: { productId: "asc" },
    });
    for (const hold of holds) {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${hold.productId} FOR UPDATE`;
      for (const allocation of hold.allocations)
        await tx.productBatch.update({
          where: { id: allocation.batchId },
          data: { quantityAvailable: { increment: allocation.quantity } },
        });
      const product = await tx.product.update({
        where: { id: hold.productId },
        data: { stockQuantity: { increment: hold.quantity } },
      });
      const saleLine = order.saleId
        ? await tx.saleItem.findUnique({
            where: {
              saleId_productId: {
                saleId: order.saleId,
                productId: hold.productId,
              },
            },
          })
        : null;
      const cost =
        saleLine?.unitCostSnapshot ??
        product.costPrice ??
        new Prisma.Decimal(0);
      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: order.companyId,
          productId: hold.productId,
          type: "RETURN",
          quantity: hold.quantity,
          notes: `Reposición pedido ${order.number}`,
        },
      });
      await this.kardex.recordInMovement(
        order.companyId,
        hold.productId,
        hold.quantity,
        cost,
        movement.id,
        tx,
      );
    }
    await tx.storeRefund.update({
      where: { id: refund.id },
      data: { restockedAt: new Date() },
    });
    await this.note(
      tx,
      order,
      "El negocio registró la recepción de los productos devueltos.",
      userId,
    );
  }
  @Interval(30000)
  async expire() {
    try {
      const orders = await this.prisma.storeOrder.findMany({
        where: {
          saleId: null,
          paymentStatus: { notIn: ["PAID", "REFUNDED"] },
          status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
          expiresAt: { lt: new Date() },
        },
        select: { id: true, companyId: true },
        take: 50,
      });
      for (const order of orders)
        await this.cancel(
          order.companyId,
          order.id,
          undefined,
          undefined,
          true,
        ).catch(() => undefined);
    } catch {
      this.logger.warn("La revisión de pedidos vencidos se reintentará");
    }
  }
}
