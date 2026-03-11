import { IsBoolean, IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  firstName!: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsIn(['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'STAFF'])
  role!: 'COMPANY_ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsIn(['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'STAFF'])
  role?: 'COMPANY_ADMIN' | 'MANAGER' | 'CASHIER' | 'STAFF';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

