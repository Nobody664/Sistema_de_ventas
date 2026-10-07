import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export class CreatePlanUpgradeRequestDto {
  @IsString()
  @IsNotEmpty()
  newPlanCode!: string;

  @IsEnum(PaymentProvider)
  paymentMethod!: PaymentProvider;

  @IsString()
  @IsOptional()
  billingCycle?: 'MONTHLY' | 'YEARLY';

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'idempotencyKey solo puede contener letras, numeros, punto, guion bajo y guion',
  })
  idempotencyKey?: string;
}

export class SubmitUpgradeProofDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000)
  @Matches(/^data:image\//, {
    message: 'imageBase64 debe ser una imagen Base64 válida (data:image/...)',
  })
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
