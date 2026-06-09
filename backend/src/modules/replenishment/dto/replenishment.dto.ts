import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class ForecastQueryDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  days?: number;
}

export class CoverageQueryDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  days?: number;
}
