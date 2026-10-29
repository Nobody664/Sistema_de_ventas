import { IsBoolean, IsOptional } from "class-validator";

export class NotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  salesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  stockEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;
}
