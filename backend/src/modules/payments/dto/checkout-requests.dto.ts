import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaymentProvider } from '@prisma/client';

export enum CheckoutReviewStatus {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export class CreateCheckoutRequestDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  companyName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsString()
  planCode!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.toUpperCase() : value))
  @IsEnum(PaymentProvider)
  paymentMethod!: PaymentProvider;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message: 'idempotencyKey solo puede contener letras, numeros, punto, guion bajo y guion',
  })
  idempotencyKey?: string;
}

export class SubmitCheckoutProofDto {
  @IsString()
  @MaxLength(2_000_000)
  @Matches(/^data:image\//, {
    message: 'imageBase64 debe ser una imagen Base64 válida (data:image/...)',
  })
  imageBase64!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paymentDate?: Date;
}

export class ReviewCheckoutRequestDto {
  @IsEnum(CheckoutReviewStatus)
  status!: CheckoutReviewStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
