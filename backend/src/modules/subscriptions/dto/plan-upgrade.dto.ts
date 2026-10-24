import {
  IsEnum,
  IsIn,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from "class-validator";
import { BillingCycle, PaymentProvider } from "@prisma/client";
import { ALLOWED_IMAGE_MIME_PATTERN } from "@/common/helpers/image.helper";

export class CreatePlanUpgradeRequestDto {
  @IsString()
  @IsNotEmpty()
  newPlanCode!: string;

  @IsEnum(PaymentProvider)
  paymentMethod!: PaymentProvider;

  @IsEnum(BillingCycle)
  @IsOptional()
  billingCycle?: "MONTHLY" | "YEARLY";

  @IsString()
  @IsOptional()
  @MaxLength(100)
  @Matches(/^[A-Za-z0-9._-]+$/, {
    message:
      "idempotencyKey solo puede contener letras, numeros, punto, guion bajo y guion",
  })
  idempotencyKey?: string;
}

export class SubmitUpgradeProofDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000)
  @Matches(ALLOWED_IMAGE_MIME_PATTERN, {
    message: "imageBase64 debe ser una imagen PNG, JPEG o WebP",
  })
  imageBase64!: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}

export class ReviewPlanUpgradeDto {
  @IsOptional()
  @IsEnum(BillingCycle)
  legacyBillingCycle?: BillingCycle;

  @IsIn(["APPROVED", "REJECTED"])
  @IsNotEmpty()
  status!: "APPROVED" | "REJECTED";

  @IsString()
  @IsOptional()
  reviewNotes?: string;
}
