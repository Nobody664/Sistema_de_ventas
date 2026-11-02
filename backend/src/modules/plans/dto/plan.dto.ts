import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
} from "class-validator";
import { Type } from "class-transformer";
import {
  PLAN_FEATURE_KEYS,
  PLAN_MODULE_KEYS,
} from "@/modules/plan-capabilities/plan-capabilities.constants";

export class CreatePlanDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceMonthly!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceYearly!: number;

  @IsIn(["MONTHLY", "YEARLY"])
  billingCycle!: "MONTHLY" | "YEARLY";

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxProducts?: number;

  @IsArray()
  features!: string[];

  @IsOptional()
  @IsArray()
  @IsIn(PLAN_MODULE_KEYS as unknown as string[], { each: true })
  modules?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(PLAN_FEATURE_KEYS as unknown as string[], { each: true })
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  apiEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  apiSearchDniEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  apiQuota?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceMonthly?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceYearly?: number;

  @IsOptional()
  @IsIn(["MONTHLY", "YEARLY"])
  billingCycle?: "MONTHLY" | "YEARLY";

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxProducts?: number;

  @IsOptional()
  @IsArray()
  features?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(PLAN_MODULE_KEYS as unknown as string[], { each: true })
  modules?: string[];

  @IsOptional()
  @IsArray()
  @IsIn(PLAN_FEATURE_KEYS as unknown as string[], { each: true })
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  apiEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  apiSearchDniEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  apiQuota?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
