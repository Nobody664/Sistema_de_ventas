import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsInt,
  Max,
  Matches,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";
import { PlatformAccountType, PlatformTransactionType } from "@prisma/client";

export class CreatePlatformAccountDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsEnum(PlatformAccountType)
  type?: PlatformAccountType;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsNumber()
  initialBalance?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlatformAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(PlatformAccountType)
  type?: PlatformAccountType;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsNumber()
  initialBalance?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePlatformTransactionDto {
  @IsString()
  accountId!: string;

  @IsEnum(PlatformTransactionType)
  type!: PlatformTransactionType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  @MinLength(2)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;
}

export class UpdatePlatformTransactionDto {
  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsEnum(PlatformTransactionType)
  type?: PlatformTransactionType;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  description?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  companyId?: string;
}

export class QueryPlatformTransactionsDto {
  @IsOptional()
  @IsEnum(PlatformTransactionType)
  type?: PlatformTransactionType;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class QueryPlatformFinanceSummaryDto {
  @IsOptional()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
