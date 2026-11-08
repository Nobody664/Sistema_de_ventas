import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Max,
  Min,
} from "class-validator";
import { StoreIdentifier, StoreText } from "./store-validation";

export class StoreCommerceSettingsDto {
  @IsBoolean() checkoutEnabled!: boolean;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) taxRate!: number;
  @IsBoolean() pricesIncludeTax!: boolean;
  @IsInt() @Min(5) @Max(1440) reservationMinutes!: number;
}
export class StorePaymentMethodDto {
  @IsIn(["TRANSFER", "YAPE", "PLIN", "CASH_ON_PICKUP", "MERCADOPAGO"])
  code!: string;
  @StoreText(2, 80) label!: string;
  @StoreText(0, 2000, true) instructions!: string;
  @IsBoolean() enabled!: boolean;
}
export class StoreShippingMethodDto {
  @IsIn(["PICKUP", "DELIVERY"]) kind!: string;
  @StoreText(2, 80) label!: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000) fee!: number;
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique()
  @Matches(/^\d{6}$/, { each: true })
  districts!: string[];
  @IsOptional() @StoreText(0, 240) pickupAddress?: string;
  @IsBoolean() enabled!: boolean;
}
export class StoreCartItemDto {
  @IsInt() @Min(1) version!: number;
  @StoreIdentifier() productId!: string;
  @IsOptional() @StoreIdentifier() presentationId?: string;
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Max(10000)
  quantity!: number;
}
export class StoreQuoteDto {
  @IsInt() @Min(1) cartVersion!: number;
  @StoreIdentifier() paymentMethodId!: string;
  @StoreIdentifier() shippingMethodId!: string;
  @IsOptional() @StoreIdentifier() addressId?: string;
}
