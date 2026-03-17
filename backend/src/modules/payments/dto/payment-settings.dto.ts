import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, IsObject } from 'class-validator';
import { PaymentProvider } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500000)
  qrImageBase64?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  accountName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  config?: Record<string, unknown>;
}

export class PaymentSettingsResponseDto {
  id!: string;
  provider!: PaymentProvider;
  isEnabled!: boolean;
  qrImageBase64?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  instructions?: string | null;
  config?: Record<string, unknown> | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class UploadPaymentProofDto {
  @IsString()
  @MaxLength(500000)
  imageBase64!: string;

  @IsString()
  amount!: string;

  @IsOptional()
  paymentDate?: Date;
}

export class PaymentProofResponseDto {
  id!: string;
  subscriptionId!: string;
  imageBase64!: string;
  amount!: string;
  paymentDate!: Date;
  status!: string;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  notes?: string | null;
  createdAt!: Date;
  updatedAt!: Date;
}

export class ReviewPaymentProofDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  notes?: string;
}
