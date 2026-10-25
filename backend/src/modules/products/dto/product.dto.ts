import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsDateString,
  ValidateIf,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsIn,
  Matches,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { UnitOfMeasure } from "@prisma/client";
import { ALLOWED_IMAGE_MIME_PATTERN } from "@/common/helpers/image.helper";

export class QueryProductDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UploadProductImageDto {
  @IsString()
  @MaxLength(2_000_000)
  @Matches(ALLOWED_IMAGE_MIME_PATTERN, {
    message: "imageBase64 debe ser una imagen PNG, JPEG o WebP",
  })
  imageBase64!: string;
}

export class ExportProductsQueryDto {
  @IsOptional()
  @IsIn(["csv", "excel", "pdf"])
  format?: "csv" | "excel" | "pdf" = "csv";

  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class CreatePresentationDto {
  @IsString()
  name!: string;

  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Type(() => Number)
  factor!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  price?: number | null;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePresentationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Type(() => Number)
  factor?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Type(() => Number)
  price?: number | null;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  imageUrl?: string;

  @IsOptional()
  @IsEnum(UnitOfMeasure)
  baseUnit?: UnitOfMeasure;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costPrice!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  salePrice!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Type(() => Number)
  stockQuantity?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Type(() => Number)
  minStock?: number;

  @IsOptional()
  @IsDateString({ strict: true })
  expiryDate?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePresentationDto)
  presentations?: CreatePresentationDto[];
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2_000_000)
  imageUrl?: string | null;

  @IsOptional()
  @IsEnum(UnitOfMeasure)
  baseUnit?: UnitOfMeasure;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  costPrice?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  salePrice?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @Type(() => Number)
  minStock?: number;

  @IsOptional()
  @IsDateString({ strict: true })
  expiryDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertPresentationsDto {
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => CreatePresentationDto)
  presentations!: CreatePresentationDto[];
}
