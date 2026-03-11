import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class CreateCompanyWithPlanDto extends CreateCompanyDto {
  @IsUUID()
  planId!: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateCompanyStatusDto {
  @IsIn(['ACTIVE', 'SUSPENDED', 'TRIAL', 'PAST_DUE'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'TRIAL' | 'PAST_DUE';
}
