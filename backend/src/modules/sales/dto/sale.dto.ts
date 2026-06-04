import { ArrayMinSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateSaleItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  discountAmount?: number;
}

export class CreateSaleDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsIn(['CASH', 'CARD', 'TRANSFER'])
  paymentMethod!: 'CASH' | 'CARD' | 'TRANSFER';

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  discountAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}

export class ExportSalesQueryDto {
  @IsOptional()
  @IsIn(['csv', 'excel', 'pdf'])
  format?: 'csv' | 'excel' | 'pdf' = 'csv';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(['COMPLETED', 'CANCELLED', 'REFUNDED', 'PENDING'])
  status?: 'COMPLETED' | 'CANCELLED' | 'REFUNDED' | 'PENDING';

  @IsOptional()
  @IsString()
  customerId?: string;
}

