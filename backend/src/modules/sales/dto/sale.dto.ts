import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

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
}

export class CreateSaleDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsIn(["POS", "DISTRIBUTOR", "ONLINE"])
  channel?: "POS" | "DISTRIBUTOR" | "ONLINE";

  @IsOptional()
  @IsString()
  distributorId?: string;

  @IsIn(["CASH", "CARD", "TRANSFER"])
  paymentMethod!: "CASH" | "CARD" | "TRANSFER";

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  taxAmount?: number;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  discountAmount?: number;

  @IsOptional()
  @IsString()
  couponCode?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}

export class QuerySalesDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;
}

export class CancelSaleDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ExportSalesQueryDto {
  @IsOptional()
  @IsIn(["csv", "excel", "pdf"])
  format?: "csv" | "excel" | "pdf" = "csv";

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsIn(["COMPLETED", "CANCELLED", "REFUNDED", "PENDING"])
  status?: "COMPLETED" | "CANCELLED" | "REFUNDED" | "PENDING";

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsIn(["POS", "DISTRIBUTOR", "ONLINE"])
  channel?: "POS" | "DISTRIBUTOR" | "ONLINE";
}
