import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class StoreCommerceSettingsDto {
  @IsBoolean() checkoutEnabled!: boolean;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) taxRate!: number;
  @IsBoolean() pricesIncludeTax!: boolean;
  @IsInt() @Min(5) @Max(1440) reservationMinutes!: number;
}
export class StorePaymentMethodDto {
  @IsIn(["TRANSFER", "YAPE", "PLIN", "CASH_ON_PICKUP", "MERCADOPAGO"])
  code!: string;
  @IsString() @MinLength(2) @MaxLength(80) label!: string;
  @IsString() @MaxLength(2000) instructions!: string;
  @IsBoolean() enabled!: boolean;
}
export class StoreShippingMethodDto {
  @IsIn(["PICKUP", "DELIVERY"]) kind!: string;
  @IsString() @MinLength(2) @MaxLength(80) label!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000) fee!: number;
  @IsArray()
  @ArrayMaxSize(200)
  @Matches(/^\d{6}$/, { each: true })
  districts!: string[];
  @IsOptional() @IsString() @MaxLength(240) pickupAddress?: string;
  @IsBoolean() enabled!: boolean;
}
export class StoreCartItemDto {
  @IsInt() @Min(1) version!: number;
  @IsString() @MaxLength(128) productId!: string;
  @IsOptional() @IsString() @MaxLength(128) presentationId?: string;
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(10000)
  quantity!: number;
}
export class StoreQuoteDto {
  @IsInt() @Min(1) cartVersion!: number;
  @IsString() @MaxLength(128) paymentMethodId!: string;
  @IsString() @MaxLength(128) shippingMethodId!: string;
  @IsOptional() @IsString() @MaxLength(128) addressId?: string;
}
