import { IsInt, IsOptional, IsString } from 'class-validator';

export class CreateInventoryAdjustmentDto {
  @IsString()
  productId!: string;

  @IsInt()
  quantity!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

