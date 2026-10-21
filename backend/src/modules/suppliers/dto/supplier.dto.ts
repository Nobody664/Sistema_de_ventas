import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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

export class CreateSupplierDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactName?: string;

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
  @IsString()
  @MaxLength(20)
  documentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  documentValue?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brands?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  leadTimeDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  contactName?: string;

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
  @IsString()
  @MaxLength(20)
  documentType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  documentValue?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  brands?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  leadTimeDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class QuerySuppliersDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["true", "false"])
  isActive?: string;
}

export class SupplierProductItemDto {
  @IsString()
  productId!: string;

  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minOrderQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  supplierSku?: string;
}

export class SetSupplierProductsDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => SupplierProductItemDto)
  items!: SupplierProductItemDto[];
}

class SupplierOrderItemDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  requestedQuantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost?: number;
}

export class CreateSupplierOrderDto {
  @IsString()
  supplierId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplierOrderItemDto)
  items!: SupplierOrderItemDto[];
}

class ReceiveSupplierOrderItemDto {
  @IsString()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity!: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost!: number;
}

export class ReceiveSupplierOrderDto {
  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveSupplierOrderItemDto)
  items!: ReceiveSupplierOrderItemDto[];
}

export class UpdateSupplierOrderStatusDto {
  @IsIn(["DRAFT", "SENT", "CONFIRMED", "CANCELLED"])
  status!: "DRAFT" | "SENT" | "CONFIRMED" | "CANCELLED";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class QuerySupplierOrdersDto {
  @IsOptional()
  @IsIn(["DRAFT", "SENT", "CONFIRMED", "CANCELLED"])
  status?: "DRAFT" | "SENT" | "CONFIRMED" | "CANCELLED";

  @IsOptional()
  @IsString()
  supplierId?: string;
}
