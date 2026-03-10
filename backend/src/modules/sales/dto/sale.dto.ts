import { ArrayMinSize, IsArray, IsIn, IsInt, IsNumberString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class CreateSaleItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsNumberString()
  discountAmount?: string;
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
  @IsNumberString()
  taxAmount?: string;

  @IsOptional()
  @IsNumberString()
  discountAmount?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}

