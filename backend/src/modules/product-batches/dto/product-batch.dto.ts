import { IsDateString, IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductBatchDto {
  @IsString()
  productId!: string;

  @IsString()
  batchNumber!: string;

  @IsInt()
  @Min(1)
  quantityReceived!: number;

  @IsInt()
  @Min(0)
  quantityAvailable!: number;

  @Type(() => Number)
  purchasePrice!: number;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}

export class UpdateProductBatchDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  quantityAvailable?: number;

  @IsOptional()
  @Type(() => Number)
  purchasePrice?: number;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;
}

export class ReserveBatchDto {
  @IsInt()
  @IsPositive()
  quantity!: number;
}

export class QueryProductBatchDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}
