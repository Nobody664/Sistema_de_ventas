import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from "class-validator";

const COUPON_CODE = /^[A-Za-z0-9_-]{3,32}$/;

export class CreateDiscountCouponDto {
  @IsString()
  @Matches(COUPON_CODE, {
    message:
      "El codigo debe tener entre 3 y 32 caracteres (letras, numeros, guion o guion bajo).",
  })
  code!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(["PERCENTAGE", "FIXED"])
  type?: "PERCENTAGE" | "FIXED";

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  value!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxUses?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  minPurchase?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiscountCouponDto {
  @IsOptional()
  @IsString()
  @Matches(COUPON_CODE, {
    message:
      "El codigo debe tener entre 3 y 32 caracteres (letras, numeros, guion o guion bajo).",
  })
  code?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsIn(["PERCENTAGE", "FIXED"])
  type?: "PERCENTAGE" | "FIXED";

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  value?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  maxUses?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  minPurchase?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QueryDiscountCouponDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsIn(["true", "false"])
  isActive?: "true" | "false";

  @IsOptional()
  @IsString()
  search?: string;
}

export class ValidateDiscountCouponDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  subtotal?: number;
}
