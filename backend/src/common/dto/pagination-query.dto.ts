import { Type } from "class-transformer";
import { IsInt, Max, Min, ValidateIf } from "class-validator";

export class PaginationQueryDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page?: number = 1;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
