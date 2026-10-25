import {
  Injectable,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { optionalDate } from "@/common/helpers/patch-contract.helper";
import { SubscriptionSettlementService } from "./subscription-settlement.service";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { PaymentProvider, ProofStatus } from "@prisma/client";
import { parseImageDataUrl } from "@/common/helpers/image.helper";
import {
  UpdatePaymentSettingsDto,
  PaymentSettingsResponseDto,
  PaymentSettingsPublicResponseDto,
  UploadPaymentProofDto,
  PaymentProofResponseDto,
  ReviewPaymentProofDto,
} from "./dto/payment-settings.dto";

@Injectable()
export class PaymentSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlements: SubscriptionSettlementService,
  ) {}

  async getPublicSettings(): Promise<PaymentSettingsPublicResponseDto[]> {
    return this.prisma.paymentSetting.findMany({
      orderBy: { provider: "asc" },
      select: {
        id: true,
        provider: true,
        isEnabled: true,
        qrImageBase64: true,
        accountNumber: true,
        accountName: true,
        instructions: true,
      },
    });
  }

  async getPublicSettingByProvider(
    provider: PaymentProvider,
  ): Promise<PaymentSettingsPublicResponseDto | null> {
    return this.prisma.paymentSetting.findFirst({
      where: { provider },
      select: {
        id: true,
        provider: true,
        isEnabled: true,
        qrImageBase64: true,
        accountNumber: true,
        accountName: true,
        instructions: true,
      },
    });
  }

  async getAllSettings(): Promise<PaymentSettingsResponseDto[]> {
    return this.prisma.paymentSetting.findMany({
      orderBy: { provider: "asc" },
    }) as Promise<PaymentSettingsResponseDto[]>;
  }

  async getSettingsByProvider(
    provider: PaymentProvider,
  ): Promise<PaymentSettingsResponseDto | null> {
    return this.prisma.paymentSetting.findFirst({
      where: { provider },
    }) as Promise<PaymentSettingsResponseDto | null>;
  }

  async updateSettings(
    provider: PaymentProvider,
    data: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponseDto> {
    const payload = { ...data };

    if (
      payload.qrImageBase64 !== undefined &&
      payload.qrImageBase64 !== null &&
      payload.qrImageBase64 !== ""
    ) {
      payload.qrImageBase64 = (
        await parseImageDataUrl(payload.qrImageBase64, 500_000)
      ).dataUrl;
    }

    const existing = await this.prisma.paymentSetting.findFirst({
      where: { provider },
    });

    if (existing) {
      return this.prisma.paymentSetting.update({
        where: { id: existing.id },
        data: {
          ...payload,
          config: payload.config ?? {},
        } as never,
      }) as Promise<PaymentSettingsResponseDto>;
    }

    return this.prisma.paymentSetting.create({
      data: {
        provider,
        ...payload,
        config: payload.config ?? {},
      } as never,
    }) as Promise<PaymentSettingsResponseDto>;
  }

  async getEnabledProvider(
    provider: PaymentProvider,
  ): Promise<PaymentSettingsResponseDto | null> {
    const settings = await this.prisma.paymentSetting.findFirst({
      where: { provider, isEnabled: true },
    });

    return settings as PaymentSettingsResponseDto | null;
  }

  async uploadPaymentProof(
    subscriptionId: string,
    data: UploadPaymentProofDto,
    companyId: string,
  ): Promise<PaymentProofResponseDto> {
    const imageBase64 = (await parseImageDataUrl(data.imageBase64)).dataUrl;
    return serializableTransaction(this.prisma, async (tx) => {
      const subscription = await tx.subscription.findFirst({
        where: { id: subscriptionId, companyId },
        include: { plan: true },
      });

      if (!subscription) {
        throw new NotFoundException(
          `Suscripción #${subscriptionId} no encontrada`,
        );
      }

      const expected =
        subscription.billingCycle === "YEARLY"
          ? subscription.plan.priceYearly
          : subscription.plan.priceMonthly;
      if (!expected.gt(0) || !expected.equals(data.amount))
        throw new ConflictException(
          "El importe del comprobante no coincide con el plan contratado",
        );
      const paymentDate = optionalDate(data.paymentDate, false) ?? new Date();
      if (paymentDate.getTime() > Date.now() + 60000)
        throw new ConflictException("La fecha del pago no puede ser futura");
      const existingPending = await tx.paymentProof.findFirst({
        where: { subscriptionId: subscription.id, status: ProofStatus.PENDING },
        select: { id: true },
      });

      if (existingPending) {
        throw new ConflictException(
          "Ya existe un comprobante pendiente de revisión para esta suscripción",
        );
      }

      const offline: PaymentProvider[] = [
        PaymentProvider.CASH,
        PaymentProvider.TRANSFER,
        PaymentProvider.YAPE,
        PaymentProvider.PLIN,
        PaymentProvider.CARD,
      ];
      const pending = await tx.payment.findFirst({
        where: {
          subscriptionId,
          status: "PENDING",
          amount: expected,
          currency: "PEN",
          provider: { in: offline },
        },
        orderBy: { createdAt: "desc" },
      });
      const payment =
        pending ??
        (await tx.payment.create({
          data: {
            subscriptionId,
            amount: expected,
            currency: "PEN",
            provider: offline.includes(subscription.provider)
              ? subscription.provider
              : PaymentProvider.TRANSFER,
            status: "PENDING",
            transactionId: `proof-${randomUUID()}`,
            providerPayload: {
              kind: "OFFLINE_PROOF",
              planId: subscription.planId,
              billingCycle: subscription.billingCycle,
            },
          },
        }));
      return tx.paymentProof.create({
        data: {
          subscriptionId: subscription.id,
          paymentId: payment.id,
          imageBase64,
          amount: expected.toString(),
          paymentDate,
          status: ProofStatus.PENDING,
        },
      }) as Promise<PaymentProofResponseDto>;
    });
  }

  async getProofsBySubscription(
    subscriptionId: string,
    companyId: string,
  ): Promise<PaymentProofResponseDto[]> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, companyId },
      select: { id: true },
    });

    if (!subscription) {
      throw new NotFoundException(
        `Suscripción #${subscriptionId} no encontrada`,
      );
    }

    return this.prisma.paymentProof.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: "desc" },
    }) as Promise<PaymentProofResponseDto[]>;
  }

  async getPendingProofs(): Promise<PaymentProofResponseDto[]> {
    return this.prisma.paymentProof.findMany({
      where: { status: ProofStatus.PENDING },
      orderBy: { createdAt: "asc" },
    }) as Promise<PaymentProofResponseDto[]>;
  }

  async reviewProof(
    proofId: string,
    reviewerId: string,
    data: ReviewPaymentProofDto,
  ): Promise<PaymentProofResponseDto> {
    return serializableTransaction(this.prisma, async (tx) => {
      if (!["APPROVED", "REJECTED"].includes(data.status))
        throw new ConflictException("Decisión de revisión inválida");
      const proof = await tx.paymentProof.findUnique({
        where: { id: proofId },
        include: {
          subscription: {
            include: { plan: true, company: true },
          },
        },
      });

      if (!proof) {
        throw new NotFoundException("Comprobante no encontrado");
      }
      if (proof.status === data.status) {
        const { subscription, ...view } = proof;
        return view;
      }

      const updated = await tx.paymentProof.updateMany({
        where: { id: proofId, status: ProofStatus.PENDING },
        data: {
          status: data.status,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          notes: data.notes,
        },
      });
      if (updated.count === 0) {
        throw new ConflictException("El comprobante ya fue revisado");
      }

      if (data.status === "APPROVED") {
        const pending = await tx.payment.findFirst({
          where: {
            subscriptionId: proof.subscriptionId,
            status: proof.paymentId ? undefined : "PENDING",
            ...(proof.paymentId
              ? { id: proof.paymentId }
              : { amount: new Prisma.Decimal(proof.amount) }),
            currency: "PEN",
            provider: {
              in: [
                PaymentProvider.CASH,
                PaymentProvider.TRANSFER,
                PaymentProvider.YAPE,
                PaymentProvider.PLIN,
                PaymentProvider.CARD,
              ],
            },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!pending || !pending.amount.equals(proof.amount))
          throw new ConflictException(
            "El comprobante requiere un cobro pendiente vinculado para conciliarlo",
          );
        const snapshot = pending.providerPayload;
        if (
          snapshot &&
          typeof snapshot === "object" &&
          !Array.isArray(snapshot) &&
          typeof snapshot.planId === "string" &&
          snapshot.planId !== proof.subscription.planId
        )
          throw new ConflictException(
            "El cobro corresponde a otro plan; requiere conciliación",
          );
        if (!proof.paymentId) {
          const expected =
            proof.subscription.billingCycle === "YEARLY"
              ? proof.subscription.plan.priceYearly
              : proof.subscription.plan.priceMonthly;
          if (!expected.equals(proof.amount))
            throw new ConflictException(
              "El comprobante histórico requiere conciliación del importe",
            );
        }
        await this.settlements.confirmManualWithinTransaction(
          tx,
          pending.id,
          { sub: reviewerId, email: "", roles: ["SUPER_ADMIN"] },
          {
            reason:
              data.notes?.trim() || "Comprobante contrastado y verificado",
            paymentDate: proof.paymentDate.toISOString(),
          },
        );
        if (!proof.paymentId)
          await tx.paymentProof.update({
            where: { id: proofId },
            data: { paymentId: pending.id },
          });
      }

      const result: PaymentProofResponseDto = {
        id: proof.id,
        subscriptionId: proof.subscriptionId,
        imageBase64: proof.imageBase64,
        amount: proof.amount,
        paymentDate: proof.paymentDate,
        status: data.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        notes: data.notes,
        createdAt: proof.createdAt,
        updatedAt: new Date(),
      };

      return result;
    });
  }

  async getProofById(
    proofId: string,
    companyId?: string,
  ): Promise<PaymentProofResponseDto> {
    const proof = await this.prisma.paymentProof.findFirst({
      where: companyId
        ? { id: proofId, subscription: { companyId } }
        : { id: proofId },
      include: { subscription: { select: { companyId: true } } },
    });

    if (!proof || (companyId && proof.subscription.companyId !== companyId)) {
      throw new NotFoundException(`Comprobante #${proofId} no encontrado`);
    }

    const { subscription, ...rest } = proof;
    return rest as PaymentProofResponseDto;
  }
}
