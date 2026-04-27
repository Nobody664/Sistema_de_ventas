import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

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

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string;

  @IsIn(['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER'])
  role!: 'COMPANY_ADMIN' | 'MANAGER' | 'CASHIER' | 'VIEWER';

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
  @IsString()
  @MinLength(8, { message: 'El DNI debe tener 8 dígitos' })
  dni?: string;

  @IsOptional()
  @IsIn(['COMPANY_ADMIN', 'MANAGER', 'CASHIER', 'VIEWER'])
  role?: 'COMPANY_ADMIN' | 'MANAGER' | 'CASHIER' | 'VIEWER';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

