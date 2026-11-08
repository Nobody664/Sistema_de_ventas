import {
  Equals,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";
import {
  StoreEmail,
  StoreIdentifier,
  StoreText,
  STORE_PHONE_PATTERN,
} from "./store-validation";

export class StoreLoginDto {
  @StoreEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(256) password!: string;
}
export class StoreRegisterDto extends StoreLoginDto {
  @StoreText(2, 100) firstName!: string;
  @StoreText(2, 100) lastName!: string;
  @Equals(true) acceptTerms!: boolean;
}
export class StoreEmailDto {
  @StoreEmail() email!: string;
}
export class StoreTokenDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
}
export class StoreResetDto extends StoreTokenDto {
  @IsString() @MinLength(8) @MaxLength(256) password!: string;
}
export class StoreProfileDto {
  @StoreText(2, 100) firstName!: string;
  @StoreText(2, 100) lastName!: string;
  @IsString() @Matches(/^\d{8}$/) documentValue!: string;
  @StoreText(7, 20) @Matches(STORE_PHONE_PATTERN) phone!: string;
}
export class StoreAddressDto {
  @StoreText(1, 60) label!: string;
  @StoreText(2, 160) recipient!: string;
  @StoreText(7, 20) @Matches(STORE_PHONE_PATTERN) phone!: string;
  @StoreText(5, 240) street!: string;
  @IsString() @Matches(/^\d{6}$/) district!: string;
  @IsOptional() @StoreText(0, 240) reference?: string;
  @IsBoolean() isDefault!: boolean;
}
export class StoreCatalogQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) limit: number =
    24;
  @IsOptional() @StoreText(0, 160) search?: string;
  @IsOptional() @StoreIdentifier() categoryId?: string;
}
export class StoreSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsBoolean() registrationEnabled!: boolean;
  @IsOptional() @StoreText(0, 100) title?: string;
  @IsOptional() @StoreText(0, 1000, true) description?: string;
}
export class StorePublishDto {
  @IsBoolean() visible!: boolean;
}
export class StoreAccountStatusDto {
  @IsBoolean() suspended!: boolean;
}
