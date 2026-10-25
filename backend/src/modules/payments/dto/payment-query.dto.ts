import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateCheckoutSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  planCode!: string;
}
