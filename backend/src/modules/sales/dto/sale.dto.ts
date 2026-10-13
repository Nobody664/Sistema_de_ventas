import { ArrayMinSize, IsArray, IsDateString, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateSaleItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  presentationId?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Type(() => Number)
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

  @IsOptional()
  @IsIn(['POS', 'DISTRIBUTOR', 'ONLINE'])
  channel?: 'POS' | 'DISTRIBUTOR' | 'ONLINE';

  @IsOptional()
  @IsString()
  distributorId?: string;

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

  @IsOptional()
  @IsIn(['POS', 'DISTRIBUTOR', 'ONLINE'])
  channel?: 'POS' | 'DISTRIBUTOR' | 'ONLINE';
}

