import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class CreditNoteItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MaxLength(200)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;
}

export class CreateCreditNoteDto {
  @IsString()
  saleId!: string;

  @IsOptional()
  @IsIn(["CREDIT", "DEBIT"])
  type?: "CREDIT" | "DEBIT";

  @IsOptional()
  @IsIn(["RETURN", "DISCOUNT", "CORRECTION", "OTHER"])
  reason?: "RETURN" | "DISCOUNT" | "CORRECTION" | "OTHER";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto)
  items?: CreditNoteItemDto[];
}

export class QueryCreditNotesDto {
  @IsOptional()
  @IsString()
  saleId?: string;

  @IsOptional()
  @IsIn(["CREDIT", "DEBIT"])
  type?: "CREDIT" | "DEBIT";

  @IsOptional()
  @IsIn(["ISSUED", "APPLIED", "CANCELLED"])
  status?: "ISSUED" | "APPLIED" | "CANCELLED";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}
