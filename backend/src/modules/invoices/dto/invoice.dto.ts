import { IsBoolean, IsOptional, IsString, IsNumber, IsObject, IsDecimal, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInvoiceTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headerText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyRuc?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCompany?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showCustomer?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showEmployee?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showItems?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSubtotal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showTax?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showDiscount?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSaleNumber?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSaleDate?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showSaleTime?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  showPaymentMethod?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  footerText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  customFields?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fontFamily?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(20)
  fontSize?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paperSize?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateInvoiceTemplateDto extends CreateInvoiceTemplateDto {}

export class GenerateInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  saleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  format?: string;
}
