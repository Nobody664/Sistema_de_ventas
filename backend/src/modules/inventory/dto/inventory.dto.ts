import { IsEnum, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Type } from "class-transformer";
import { InventoryMovementType } from "@prisma/client";

export class CreateInventoryAdjustmentDto {
  @IsString()
  productId!: string;

  @IsEnum(InventoryMovementType)
  type!: InventoryMovementType;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Type(() => Number)
  quantity!: number;

  @IsOptional()
  @IsString()
  presentationId?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  unitCost?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
