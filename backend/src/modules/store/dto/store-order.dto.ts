import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  Matches,
} from "class-validator";
import { StoreIdentifier, StoreText } from "./store-validation";

export class StoreCreateOrderDto {
  @StoreIdentifier() quoteId!: string;
  @IsString() @MinLength(16) @MaxLength(128) idempotencyKey!: string;
}
export class StoreProofDto {
  @IsString() @MaxLength(2000000) image!: string;
}
export class StoreOrderActionDto {
  @IsInt() @Min(1) version!: number;
  @IsIn([
    "APPROVE_PAYMENT",
    "REJECT_PROOF",
    "PREPARE",
    "READY",
    "SHIP",
    "DELIVER",
    "CANCEL",
    "EXTEND",
    "RESTOCK",
  ])
  action!: string;
  @IsOptional() @StoreText(0, 240) reference?: string;
  @IsOptional() @StoreText(5, 500, true) reason?: string;
}
export class StoreReasonDto {
  @StoreText(5, 500) reason!: string;
}
export class StoreRefundDto {
  @StoreText(5, 240) reference!: string;
  @IsOptional() @IsInt() @Min(1) version?: number;
}
export class StoreIntegrationDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  @Matches(/^[^\s\u0000-\u001f\u007f]+$/)
  accessToken!: string;
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  @Matches(/^[^\s\u0000-\u001f\u007f]+$/)
  webhookSecret!: string;
  @IsBoolean() liveMode!: boolean;
  @IsBoolean() enabled!: boolean;
}
