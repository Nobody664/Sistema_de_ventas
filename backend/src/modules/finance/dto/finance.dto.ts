import { Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const FINANCE_DIRECTIONS = ["ENTRY", "EXIT"] as const;
export const FINANCE_CATEGORIES = [
  "PURCHASE",
  "SALE",
  "PAYROLL",
  "ELECTRICITY",
  "WATER",
  "MAINTENANCE",
  "OTHER",
] as const;

export class CreateFinanceRecordDto {
  @IsIn(FINANCE_DIRECTIONS)
  direction!: (typeof FINANCE_DIRECTIONS)[number];

  @IsOptional()
  @IsIn(FINANCE_CATEGORIES)
  category?: (typeof FINANCE_CATEGORIES)[number];

  @IsString()
  @MaxLength(255)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amount!: number;

  @IsDateString()
  recordDate!: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplier?: string | null;

  @IsOptional()
  @IsString()
  employeeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateFinanceRecordDto {
  @IsOptional()
  @IsIn(FINANCE_DIRECTIONS)
  direction?: (typeof FINANCE_DIRECTIONS)[number];

  @IsOptional()
  @IsIn(FINANCE_CATEGORIES)
  category?: (typeof FINANCE_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsDateString()
  recordDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  supplier?: string | null;

  @IsOptional()
  @IsString()
  employeeId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class QueryFinanceRecordDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsIn(FINANCE_DIRECTIONS)
  direction?: (typeof FINANCE_DIRECTIONS)[number];

  @IsOptional()
  @IsIn(FINANCE_CATEGORIES)
  category?: (typeof FINANCE_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;
}
