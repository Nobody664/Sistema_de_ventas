import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  IsDate,
} from "class-validator";
import { PaymentProvider } from "@prisma/client";
import { Type } from "class-transformer";
import { ALLOWED_IMAGE_MIME_PATTERN } from "@/common/helpers/image.helper";

export class UpdatePaymentSettingsDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500000)
  @ValidateIf((_object: unknown, value: unknown) => value !== "")
  @Matches(ALLOWED_IMAGE_MIME_PATTERN, {
    message: "qrImageBase64 debe ser una imagen PNG, JPEG o WebP",
  })
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

export class PaymentSettingsPublicResponseDto {
  id!: string;
  provider!: PaymentProvider;
  isEnabled!: boolean;
  qrImageBase64?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  instructions?: string | null;
}

export class UploadPaymentImageDto {
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

export class UploadPaymentProofDto extends UploadPaymentImageDto {
  @IsString()
  amount!: string;
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
  @IsEnum(["APPROVED", "REJECTED"])
  status!: "APPROVED" | "REJECTED";

  @IsOptional()
  @IsString()
  notes?: string;
}
