import { Type, Transform } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class BatchExpiryQueryDto {
  @IsOptional() @IsIn(["ALL", "EXPIRED", "EXPIRING"]) status:
    "ALL" | "EXPIRED" | "EXPIRING" = "ALL";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MaxLength(160)
  search?: string;
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,128}$/)
  productId?: string;
}

export class BatchWriteOffDto {
  @IsDateString({ strict: true }) expectedUpdatedAt!: string;
  @IsString()
  @Matches(/^\d{1,11}(?:\.\d{1,3})?$/)
  expectedQuantityAvailable!: string;
  @IsString()
  @Matches(/^\d{1,8}(?:\.\d{1,4})?$/)
  expectedPurchasePrice!: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(5)
  @MaxLength(240)
  @Matches(/^[^<>\u0000-\u001f\u007f]+$/)
  reason!: string;
}
