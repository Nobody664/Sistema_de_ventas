import { Transform } from "class-transformer";
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export const READ_API_SCOPES = [
  "catalog.read",
  "inventory.read",
  "sales.read",
] as const;

export class CreateApiKeyDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(READ_API_SCOPES, { each: true })
  scopes!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}

export class IntegrationPageDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  after?: string;
}
