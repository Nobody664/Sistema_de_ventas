import { Transform } from "class-transformer";
import { IsString, IsUrl, MaxLength, MinLength } from "class-validator";

export class CreateWebhookDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsUrl({ protocols: ["https"], require_protocol: true, disallow_auth: true })
  @MaxLength(1000)
  url!: string;
}
