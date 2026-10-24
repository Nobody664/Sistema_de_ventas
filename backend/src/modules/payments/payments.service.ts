import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  NotImplementedException,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { IncomingHttpHeaders } from "http";
import { PaymentProvider } from "@prisma/client";
import { PrismaService } from "@/database/prisma/prisma.service";
import { AuthUser } from "@/common/decorators/current-user.decorator";
import { parseImageDataUrl } from "@/common/helpers/image.helper";
import { ConfirmSubscriptionPaymentDto } from "./dto/confirm-subscription-payment.dto";
import { MercadoPagoGateway } from "./mercado-pago.gateway";
import { SubscriptionSettlementService } from "./subscription-settlement.service";

const OFFLINE_SESSION_PROVIDERS = new Set(["yape", "plin", "transfer"]);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mercadoPago: MercadoPagoGateway,
    private readonly settlements: SubscriptionSettlementService,
  ) {}

  async findByCompany(companyId: string) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { companyId },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
        },
        plan: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1,
    });

    if (!subscriptions.length) {
      return [];
    }

    return subscriptions[0].payments;
  }

  async getPaymentHistory(companyId: string, page = 1, limit = 20) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      select: { id: true },
    });
    if (!subscription)
      return { data: [], total: 0, page, limit, totalPages: 0 };

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { subscriptionId: subscription.id },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.payment.count({ where: { subscriptionId: subscription.id } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getCurrentPending(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      select: { id: true },
    });
    if (!subscription) return null;

    return this.prisma.payment.findFirst({
      where: {
        subscriptionId: subscription.id,
        status: "PENDING",
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async uploadProofForPayment(
    paymentId: string,
    companyId: string,
    imageBase64: string,
    paymentDate?: Date,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        id: paymentId,
        subscription: { companyId },
      },
      include: { subscription: true },
    });

    if (!payment) {
      throw new NotFoundException("Pago no encontrado");
    }

    if (payment.status !== "PENDING") {
      throw new BadRequestException("Este pago ya fue procesado");
    }

    const proofImage = await parseImageDataUrl(imageBase64);

    return this.prisma.paymentProof.create({
      data: {
        subscriptionId: payment.subscriptionId,
        imageBase64: proofImage.dataUrl,
        amount: payment.amount.toString(),
        paymentDate: paymentDate ?? new Date(),
        status: "PENDING",
      },
    });
  }

  async findPendingByCompany(companyId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId, status: "ACTIVE" },
      include: {
        payments: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        },
        plan: true,
        company: true,
      },
    });

    if (!subscription) {
      return [];
    }

    return subscription.payments;
  }

  async findOne(id: string, companyId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, subscription: { companyId } },
      include: {
        subscription: {
          include: {
            plan: true,
            company: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException("Pago no encontrado");
    }

    return payment;
  }

  async generateReceipt(id: string, companyId: string) {
    const payment = await this.findOne(id, companyId);

    const subscription = payment.subscription;
    const company = subscription.company;
    const plan = subscription.plan;

    const receipt = {
      id: `RCP-${payment.id.slice(-8).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      dueDate:
        payment.status === "PENDING"
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          : null,
      company: {
        name: company.name,
        taxId: company.taxId || "Sin RUC",
      },
      plan: {
        name: plan.name,
        priceMonthly: plan.priceMonthly.toString(),
      },
      payment: {
        id: payment.id,
        amount: payment.amount.toString(),
        currency: payment.currency,
        status: payment.status,
        provider: payment.provider,
        createdAt: payment.createdAt,
      },
      subtotal: plan.priceMonthly.toString(),
      igv: (Number(plan.priceMonthly) * 0.18).toFixed(2),
      total: (Number(plan.priceMonthly) * 1.18).toFixed(2),
    };

    return receipt;
  }

  markAsPaid(
    id: string,
    actor: AuthUser,
    input: ConfirmSubscriptionPaymentDto,
  ) {
    return this.settlements.confirmManual(id, actor, input);
  }

  async findAllPending(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { status: "PENDING" },
        skip,
        take: limit,
        include: {
          subscription: {
            include: { plan: true, company: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.payment.count({ where: { status: "PENDING" } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getStats() {
    const totalPending = await this.prisma.payment.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    });

    const totalSucceeded = await this.prisma.payment.aggregate({
      where: { status: "SUCCEEDED" },
      _sum: { amount: true },
      _count: true,
    });

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthlyRevenue = await this.prisma.payment.aggregate({
      where: {
        status: "SUCCEEDED",
        createdAt: { gte: thisMonth },
      },
      _sum: { amount: true },
    });

    return {
      pending: {
        count: totalPending._count || 0,
        amount: totalPending._sum.amount?.toString() || "0",
      },
      succeeded: {
        count: totalSucceeded._count || 0,
        amount: totalSucceeded._sum.amount?.toString() || "0",
      },
      monthlyRevenue: monthlyRevenue._sum.amount?.toString() || "0",
    };
  }

  async createCheckoutSession(input: {
    companyId: string;
    planCode: string;
    provider: string;
  }) {
    const plan = await this.prisma.plan.findUnique({
      where: { code: input.planCode },
    });

    if (!plan || !plan.isActive) {
      throw new NotFoundException("Plan not found");
    }

    const planData = {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      priceMonthly: plan.priceMonthly.toString(),
    };

    const provider = input.provider.toLowerCase();

    if (provider === "mercadopago") {
      return this.createMercadoPagoCheckout(input.companyId, planData);
    }

    if (OFFLINE_SESSION_PROVIDERS.has(provider)) {
      const setting = await this.prisma.paymentSetting.findFirst({
        where: {
          provider: provider.toUpperCase() as PaymentProvider,
          isEnabled: true,
          isActive: true,
        },
      });

      if (!setting) {
        throw new BadRequestException("Método de pago no disponible");
      }

      return {
        provider,
        planCode: input.planCode,
        companyId: input.companyId,
        status: "pending",
        instructions: setting.instructions,
        accountNumber: setting.accountNumber,
        accountName: setting.accountName,
        qrImageBase64: setting.qrImageBase64,
        amount: planData.priceMonthly,
        currency: "PEN",
      };
    }

    throw new NotImplementedException("Proveedor de pago no soportado todavía");
  }

  private async createMercadoPagoCheckout(
    companyId: string,
    plan: { id: string; code: string; name: string; priceMonthly: string },
  ) {
    const accessToken = this.configService.get<string>(
      "MERCADOPAGO_ACCESS_TOKEN",
    );

    if (!accessToken) {
      throw new ServiceUnavailableException("Proveedor de pago no configurado");
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { subscriptions: { take: 1, select: { id: true } } },
    });
    const subscription = company?.subscriptions[0];
    if (!company || !subscription)
      throw new NotFoundException("Suscripción no encontrada");
    if (Number(plan.priceMonthly) <= 0)
      throw new BadRequestException("El plan no requiere un cobro");
    const reference = `mp-${randomUUID()}`;
    const intention = await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        provider: "MERCADOPAGO",
        status: "PENDING",
        amount: plan.priceMonthly,
        currency: "PEN",
        transactionId: reference,
        providerPayload: {
          kind: "MERCADOPAGO_CHECKOUT",
          companyId,
          planId: plan.id,
          billingCycle: "MONTHLY",
        },
      },
    });

    const frontendUrl = (
      this.configService.get<string>("FRONTEND_URL") || "http://localhost:3000"
    ).replace(/\/+$/, "");
    const apiUrl =
      this.configService.get<string>("API_URL") || `${frontendUrl}/api`;
    const returnUrl = `${frontendUrl}/subscription`;

    try {
      const result = await this.mercadoPago.createPreference({
        planCode: plan.code,
        planName: plan.name,
        amount: Number(plan.priceMonthly),
        email: company.email || "customer@example.com",
        reference,
        paymentId: intention.id,
        notificationUrl: `${apiUrl}/payments/webhooks/mercadopago`,
        returnUrl,
      });

      return {
        provider: "mercadopago",
        status: "pending",
        preferenceId: result.id,
        redirectUrl: result.redirectUrl,
        planCode: plan.code,
        companyId,
        amount: plan.priceMonthly,
        currency: "PEN",
      };
    } catch (error: unknown) {
      await this.prisma.payment.updateMany({
        where: { id: intention.id, status: "PENDING" },
        data: { status: "FAILED" },
      });
      this.logger.error(
        "No se pudo crear la preferencia del proveedor de pagos",
      );
      throw new ServiceUnavailableException(
        "No se pudo iniciar el pago con MercadoPago",
      );
    }
  }

  async handleWebhook(
    provider: string,
    payload: unknown,
    headers: IncomingHttpHeaders,
    query: Record<string, unknown>,
  ) {
    if (provider !== "mercadopago")
      throw new BadRequestException("Proveedor de webhook no soportado");
    const id = this.verifyMercadoPagoSignature(headers, query);
    const body =
      payload && typeof payload === "object" && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const data =
      body.data && typeof body.data === "object" && !Array.isArray(body.data)
        ? (body.data as Record<string, unknown>)
        : {};
    if (data.id !== undefined && String(data.id).toLowerCase() !== id)
      throw new BadRequestException(
        "El recurso notificado no coincide con la firma",
      );
    const topic = query.type ?? query.topic ?? body.type;
    if (topic !== "payment")
      return { provider, received: true, processed: false };
    const [payment, merchantId] = await Promise.all([
      this.mercadoPago.getPayment(id),
      this.mercadoPago.getMerchantId(),
    ]);
    if (
      payment.id.toLowerCase() !== id ||
      payment.collectorId !== merchantId ||
      (this.configService.get<string>("NODE_ENV") === "production" &&
        !payment.liveMode)
    ) {
      throw new BadRequestException("El pago no pertenece a esta integración");
    }
    if (payment.status !== "approved")
      return { provider, received: true, processed: false };
    const result = await this.settlements.confirmMercadoPago(payment);
    return {
      provider,
      received: true,
      processed: true,
      alreadyProcessed: result.alreadyProcessed,
    };
  }

  private verifyMercadoPagoSignature(
    headers: IncomingHttpHeaders,
    query: Record<string, unknown>,
  ): string {
    const secret = this.configService.get<string>("MERCADOPAGO_WEBHOOK_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException(
        "Verificación de webhook no configurada",
      );
    }

    const signatureHeader = headers["x-signature"];
    if (typeof signatureHeader !== "string") {
      throw new UnauthorizedException("Firma de webhook ausente.");
    }

    const parts: Record<string, string> = {};
    for (const pair of signatureHeader.split(",")) {
      const index = pair.indexOf("=");
      if (index === -1) continue;
      parts[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
    }

    const ts = parts["ts"];
    const v1 = parts["v1"];
    const requestId = headers["x-request-id"];

    const flatDataId = query?.["data.id"];
    const nestedDataId =
      query?.data && typeof query.data === "object"
        ? (query.data as Record<string, unknown>)["id"]
        : undefined;
    const dataId = typeof flatDataId === "string" ? flatDataId : nestedDataId;

    if (
      !ts ||
      !/^\d{10}(?:\d{3})?$/.test(ts) ||
      !v1 ||
      !/^[a-fA-F0-9]{64}$/.test(v1) ||
      typeof requestId !== "string" ||
      !/^[a-zA-Z0-9-]{1,128}$/.test(requestId) ||
      typeof dataId !== "string" ||
      !/^[a-zA-Z0-9-]{1,128}$/.test(dataId) ||
      (flatDataId !== undefined &&
        nestedDataId !== undefined &&
        flatDataId !== nestedDataId)
    ) {
      throw new UnauthorizedException("Firma de webhook inválida.");
    }

    const tsNumber = Number(ts);
    const MAX_WEBHOOK_AGE_MS = 10 * 60 * 1000;
    if (
      !Number.isFinite(tsNumber) ||
      Math.abs(Date.now() - (ts.length === 13 ? tsNumber : tsNumber * 1000)) >
        MAX_WEBHOOK_AGE_MS
    ) {
      throw new UnauthorizedException("Firma de webhook expirada.");
    }

    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const digest = createHmac("sha256", secret).update(manifest).digest("hex");

    const expected = Buffer.from(digest, "hex");
    const received = Buffer.from(v1, "hex");

    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException("Firma de webhook inválida.");
    }

    return dataId.toLowerCase();
  }
}
