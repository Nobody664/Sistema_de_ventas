import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { PaymentProvider, ProofStatus } from '@prisma/client';
import {
  UpdatePaymentSettingsDto,
  PaymentSettingsResponseDto,
  PaymentSettingsPublicResponseDto,
  UploadPaymentProofDto,
  PaymentProofResponseDto,
  ReviewPaymentProofDto,
} from './dto/payment-settings.dto';

@Injectable()
export class PaymentSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicSettings(): Promise<PaymentSettingsPublicResponseDto[]> {
    return this.prisma.paymentSetting.findMany({
      orderBy: { provider: 'asc' },
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
      orderBy: { provider: 'asc' },
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
    const existing = await this.prisma.paymentSetting.findFirst({
      where: { provider },
    });

    if (existing) {
      return this.prisma.paymentSetting.update({
        where: { id: existing.id },
        data: {
          ...data,
          config: data.config ?? {},
        } as never,
      }) as Promise<PaymentSettingsResponseDto>;
    }

    return this.prisma.paymentSetting.create({
      data: {
        provider,
        ...data,
        config: data.config ?? {},
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
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, companyId },
      select: { id: true },
    });

    if (!subscription) {
      throw new NotFoundException(`Suscripción #${subscriptionId} no encontrada`);
    }

    const existingPending = await this.prisma.paymentProof.findFirst({
      where: { subscriptionId: subscription.id, status: ProofStatus.PENDING },
      select: { id: true },
    });

    if (existingPending) {
      throw new ConflictException('Ya existe un comprobante pendiente de revisión para esta suscripción');
    }

    return this.prisma.paymentProof.create({
      data: {
        subscriptionId: subscription.id,
        imageBase64: data.imageBase64,
        amount: data.amount,
        paymentDate: data.paymentDate || new Date(),
        status: ProofStatus.PENDING,
      },
    }) as Promise<PaymentProofResponseDto>;
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
      throw new NotFoundException(`Suscripción #${subscriptionId} no encontrada`);
    }

    return this.prisma.paymentProof.findMany({
      where: { subscriptionId: subscription.id },
      orderBy: { createdAt: 'desc' },
    }) as Promise<PaymentProofResponseDto[]>;
  }

  async getPendingProofs(): Promise<PaymentProofResponseDto[]> {
    return this.prisma.paymentProof.findMany({
      where: { status: ProofStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    }) as Promise<PaymentProofResponseDto[]>;
  }

  async reviewProof(
    proofId: string,
    reviewerId: string,
    data: ReviewPaymentProofDto,
  ): Promise<PaymentProofResponseDto> {
    const proof = await this.prisma.paymentProof.findUnique({
      where: { id: proofId },
      include: {
        subscription: {
          include: { plan: true, company: true },
        },
      },
    });

    if (!proof) {
      throw new NotFoundException('Comprobante no encontrado');
    }

    const updated = await this.prisma.paymentProof.updateMany({
      where: { id: proofId, status: ProofStatus.PENDING },
      data: {
        status: data.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        notes: data.notes,
      },
    });
    if (updated.count === 0) {
      throw new ConflictException('El comprobante ya fue revisado');
    }

    if (data.status === 'APPROVED') {
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();

        const latestPending = await tx.payment.findFirst({
          where: {
            subscriptionId: proof.subscriptionId,
            status: 'PENDING',
          },
          orderBy: { createdAt: 'desc' },
        });

        if (latestPending) {
          await tx.payment.updateMany({
            where: { id: latestPending.id, status: 'PENDING' },
            data: {
              status: 'SUCCEEDED',
              paidAt: now,
            },
          });
        }

        const newEndDate = new Date();
        newEndDate.setMonth(newEndDate.getMonth() + (proof.subscription.billingCycle === 'YEARLY' ? 12 : 1));

        await tx.subscription.update({
          where: { id: proof.subscriptionId },
          data: {
            status: 'ACTIVE',
            endDate: newEndDate,
          },
        });

        await tx.company.update({
          where: { id: proof.subscription.companyId },
          data: { status: 'ACTIVE' },
        });
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
  }

  async getProofById(proofId: string, companyId?: string): Promise<PaymentProofResponseDto> {
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
