import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class DistributorStockItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

class DistributorSaleItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice?: number;
}

export class CreateDistributorDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsIn(["INDIVIDUAL", "COMPANY"])
  type?: "INDIVIDUAL" | "COMPANY";

  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  documentValue?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionRate?: number;

  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateDistributorDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsIn(["INDIVIDUAL", "COMPANY"])
  type?: "INDIVIDUAL" | "COMPANY";

  @IsOptional()
  @IsIn(["ACTIVE", "SUSPENDED", "BLOCKED"])
  status?: "ACTIVE" | "SUSPENDED" | "BLOCKED";

  @IsOptional()
  @IsString()
  @MaxLength(20)
  documentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  documentValue?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  commissionRate?: number;

  @IsOptional()
  @IsString()
  priceListId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class MoveDistributorStockDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DistributorStockItemDto)
  items!: DistributorStockItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RegisterDistributorSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DistributorSaleItemDto)
  items!: DistributorSaleItemDto[];

  @IsIn(["CASH", "CARD", "TRANSFER"])
  paymentMethod!: "CASH" | "CARD" | "TRANSFER";

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateDistributorDeliveryDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => DistributorStockItemDto)
  items!: DistributorStockItemDto[];

  @IsOptional()
  @IsIn(["PENDING", "DELIVERED", "CANCELLED"])
  status?: "PENDING" | "DELIVERED" | "CANCELLED";

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class SettleDistributorDto {
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class QueryDistributorsDto {
  @IsOptional()
  @IsIn(["ACTIVE", "SUSPENDED", "BLOCKED"])
  status?: "ACTIVE" | "SUSPENDED" | "BLOCKED";

  @IsOptional()
  @IsString()
  search?: string;
}
