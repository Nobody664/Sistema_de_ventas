import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma/prisma.service';
import { PaymentProvider, ProofStatus } from '@prisma/client';
import {
  UpdatePaymentSettingsDto,
  PaymentSettingsResponseDto,
  UploadPaymentProofDto,
  PaymentProofResponseDto,
  ReviewPaymentProofDto,
} from './dto/payment-settings.dto';

@Injectable()
export class PaymentSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllSettings(companyId: string): Promise<PaymentSettingsResponseDto[]> {
    return this.prisma.paymentSetting.findMany({
      where: { companyId },
      orderBy: { provider: 'asc' },
    }) as Promise<PaymentSettingsResponseDto[]>;
  }

  async getSettingsByProvider(
    companyId: string,
    provider: PaymentProvider,
  ): Promise<PaymentSettingsResponseDto | null> {
    return this.prisma.paymentSetting.findFirst({
      where: { companyId, provider },
    }) as Promise<PaymentSettingsResponseDto | null>;
  }

  async updateSettings(
    companyId: string,
    provider: PaymentProvider,
    data: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponseDto> {
    const existing = await this.prisma.paymentSetting.findFirst({
      where: { companyId, provider },
    });

    if (existing) {
      return this.prisma.paymentSetting.update({
        where: { id: existing.id },
        data: data as never,
      }) as Promise<PaymentSettingsResponseDto>;
    }

    return this.prisma.paymentSetting.create({
      data: {
        companyId,
        provider,
        ...data,
      } as never,
    }) as Promise<PaymentSettingsResponseDto>;
  }

  async getEnabledProvider(
    companyId: string,
    provider: PaymentProvider,
  ): Promise<PaymentSettingsResponseDto | null> {
    const settings = await this.prisma.paymentSetting.findFirst({
      where: { companyId, provider, isEnabled: true },
    });

    return settings as PaymentSettingsResponseDto | null;
  }

  async uploadPaymentProof(
    subscriptionId: string,
    data: UploadPaymentProofDto,
  ): Promise<PaymentProofResponseDto> {
    return this.prisma.paymentProof.create({
      data: {
        subscriptionId,
        imageBase64: data.imageBase64,
        amount: data.amount,
        paymentDate: data.paymentDate || new Date(),
        status: ProofStatus.PENDING,
      },
    }) as Promise<PaymentProofResponseDto>;
  }

  async getProofsBySubscription(
    subscriptionId: string,
  ): Promise<PaymentProofResponseDto[]> {
    return this.prisma.paymentProof.findMany({
      where: { subscriptionId },
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
    const proof = await this.prisma.paymentProof.update({
      where: { id: proofId },
      data: {
        status: data.status,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        notes: data.notes,
      },
    });

    if (data.status === 'APPROVED') {
      await this.prisma.subscription.update({
        where: { id: proof.subscriptionId },
        data: { status: 'ACTIVE' },
      });
    }

    return proof as PaymentProofResponseDto;
  }

  async getProofById(proofId: string): Promise<PaymentProofResponseDto> {
    const proof = await this.prisma.paymentProof.findUnique({
      where: { id: proofId },
    });

    if (!proof) {
      throw new NotFoundException(`Comprobante #${proofId} no encontrado`);
    }

    return proof as PaymentProofResponseDto;
  }
}