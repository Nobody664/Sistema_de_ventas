import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class StoreCreateOrderDto {
  @IsString() @MaxLength(128) quoteId!: string;
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
  @IsOptional() @IsString() @MaxLength(240) reference?: string;
}
export class StoreReasonDto {
  @IsString() @MinLength(5) @MaxLength(500) reason!: string;
}
export class StoreRefundDto {
  @IsString() @MinLength(5) @MaxLength(240) reference!: string;
}
export class StoreIntegrationDto {
  @IsString() @MinLength(10) @MaxLength(1000) accessToken!: string;
  @IsString() @MinLength(10) @MaxLength(500) webhookSecret!: string;
  @IsBoolean() liveMode!: boolean;
  @IsBoolean() enabled!: boolean;
}
