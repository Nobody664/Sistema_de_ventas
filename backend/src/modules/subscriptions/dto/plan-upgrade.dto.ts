import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber } from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePlanUpgradeRequestDto {
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  newPlanCode!: string;

  @IsEnum(PaymentProvider)
  paymentMethod!: PaymentProvider;

  @IsString()
  @IsOptional()
  billingCycle?: 'MONTHLY' | 'YEARLY';
}

export class SubmitUpgradeProofDto {
  @IsString()
  @IsNotEmpty()
  imageBase64!: string;

  @IsOptional()
  @IsString()
  paymentDate?: string;
}

export class ReviewPlanUpgradeDto {
  @IsString()
  @IsNotEmpty()
  status!: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  reviewNotes?: string;
}
