import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from "class-validator";

export class ChannelPreferencesDto {
  @IsOptional()
  @IsBoolean()
  dailyDigestEnabled?: boolean;

  @IsOptional()
  @IsIn(["es", "en"])
  locale?: string;
}

class PushKeysDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{87}=?$/)
  p256dh!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]{22}={0,2}$/)
  auth!: string;
}

export class PushSubscriptionDto {
  @IsUrl({ protocols: ["https"], require_protocol: true, disallow_auth: true })
  @MaxLength(2000)
  endpoint!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}
