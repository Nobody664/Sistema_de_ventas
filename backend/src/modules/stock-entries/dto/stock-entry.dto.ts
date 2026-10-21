import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class StockEntryItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsString()
  presentationId?: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Type(() => Number)
  quantity!: number;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  unitCost!: number;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;
}

export class CreateStockEntryDto {
  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  distributorId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  entryDate?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockEntryItemDto)
  items!: StockEntryItemDto[];
}

export class CreatePurchaseReceiptDto {
  @IsOptional()
  @IsString()
  distributorId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  series?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
