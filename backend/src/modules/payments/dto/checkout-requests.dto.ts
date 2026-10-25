import { Transform, Type } from "class-transformer";
import {
  IsDate,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";
import { PaymentProvider } from "@prisma/client";
import { ALLOWED_IMAGE_MIME_PATTERN } from "@/common/helpers/image.helper";

export enum CheckoutReviewStatus {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
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

  @IsOptional()
  @IsString()
  @Matches(/^\d{11}$/, {
    message: "taxId debe ser un RUC de 11 dígitos",
  })
  taxId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  legalName?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  planCode!: string;

  @Transform(({ value }) =>
    typeof value === "string" ? value.toUpperCase() : value,
  )
  @IsEnum(PaymentProvider)
  paymentMethod!: PaymentProvider;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      "idempotencyKey solo puede contener letras, numeros, punto, guion bajo y guion",
  })
  idempotencyKey?: string;
}

export class SubmitCheckoutProofDto {
  @IsString()
  @MaxLength(2_000_000)
  @Matches(ALLOWED_IMAGE_MIME_PATTERN, {
    message: "imageBase64 debe ser una imagen PNG, JPEG o WebP",
  })
  imageBase64!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paymentDate?: Date;
}

export class ReviewCheckoutRequestDto {
  @IsOptional()
  @IsIn(["MONTHLY", "YEARLY"])
  legacyBillingCycle?: "MONTHLY" | "YEARLY";

  @IsEnum(CheckoutReviewStatus)
  status!: CheckoutReviewStatus;

  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
