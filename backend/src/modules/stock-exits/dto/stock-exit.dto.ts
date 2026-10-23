import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class StockExitItemDto {
  @IsString()
  productId!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Type(() => Number)
  quantity!: number;
}

export class CreateStockExitDto {
  @IsString()
  distributorId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StockExitItemDto)
  items!: StockExitItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
