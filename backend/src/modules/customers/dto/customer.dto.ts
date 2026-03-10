import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateCustomerDto {
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
  documentType?: string;

  @IsOptional()
  @IsString()
  documentValue?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCustomerDto extends CreateCustomerDto {}

