import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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
