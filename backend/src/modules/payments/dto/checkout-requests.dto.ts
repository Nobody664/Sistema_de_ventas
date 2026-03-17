import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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

  @IsEnum(PaymentProvider)
  paymentMethod!: PaymentProvider;

  @IsOptional()
  @IsString()
  companyId?: string;
}

export class SubmitCheckoutProofDto {
  @IsString()
  @MaxLength(500000)
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
