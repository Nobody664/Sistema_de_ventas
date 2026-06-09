import { IsDateString, IsOptional, IsString } from 'class-validator';

export class QueryKardexDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  movementType?: string;
}
