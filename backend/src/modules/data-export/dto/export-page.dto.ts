import {
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from "class-validator";

export class ExportPageDto {
  @IsISO8601({ strict: true })
  startedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  @Matches(/^[a-zA-Z0-9_-]+(?::[a-zA-Z0-9_-]+)?$/)
  after?: string;
}
