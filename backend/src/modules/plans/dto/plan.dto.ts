import { IsArray, IsBoolean, IsIn, IsInt, IsNumberString, IsOptional, IsString, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumberString()
  priceMonthly!: string;

  @IsNumberString()
  priceYearly!: string;

  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle!: 'MONTHLY' | 'YEARLY';

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
  @IsNumberString()
  priceMonthly?: string;

  @IsOptional()
  @IsNumberString()
  priceYearly?: string;

  @IsOptional()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingCycle?: 'MONTHLY' | 'YEARLY';

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
  @IsBoolean()
  isActive?: boolean;
}
