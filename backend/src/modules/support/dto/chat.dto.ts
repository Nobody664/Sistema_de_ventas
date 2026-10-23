import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import { SupportConversationStatus } from "@prisma/client";

export class QueryConversationsDto {
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
  limit?: number = 20;

  @IsOptional()
  @IsEnum(SupportConversationStatus)
  status?: SupportConversationStatus;

  @IsOptional()
  @IsString()
  companyId?: string;
}

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyId?: string;
}

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;
}

export class UpdateConversationStatusDto {
  @IsEnum(SupportConversationStatus)
  status!: SupportConversationStatus;
}
