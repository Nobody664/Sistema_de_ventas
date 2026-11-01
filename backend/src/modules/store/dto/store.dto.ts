import {
  Equals,
  IsBoolean,
  IsEmail,
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

export class StoreLoginDto {
  @IsEmail() @MaxLength(200) email!: string;
  @IsString() @MinLength(8) @MaxLength(256) password!: string;
}
export class StoreRegisterDto extends StoreLoginDto {
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(100) lastName!: string;
  @Equals(true) acceptTerms!: boolean;
}
export class StoreEmailDto {
  @IsEmail() @MaxLength(200) email!: string;
}
export class StoreTokenDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
}
export class StoreResetDto extends StoreTokenDto {
  @IsString() @MinLength(8) @MaxLength(256) password!: string;
}
export class StoreProfileDto {
  @IsString() @MinLength(2) @MaxLength(100) firstName!: string;
  @IsString() @MinLength(2) @MaxLength(100) lastName!: string;
  @IsString() @Matches(/^\d{8}$/) documentValue!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{7,20}$/) phone!: string;
}
export class StoreAddressDto {
  @IsString() @MinLength(1) @MaxLength(60) label!: string;
  @IsString() @MinLength(2) @MaxLength(160) recipient!: string;
  @IsString() @Matches(/^\+?[0-9 ()-]{7,20}$/) phone!: string;
  @IsString() @MinLength(5) @MaxLength(240) street!: string;
  @IsString() @Matches(/^\d{6}$/) district!: string;
  @IsOptional() @IsString() @MaxLength(240) reference?: string;
  @IsBoolean() isDefault!: boolean;
}
export class StoreCatalogQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) limit: number =
    24;
  @IsOptional() @IsString() @MaxLength(160) search?: string;
  @IsOptional() @IsString() @MaxLength(128) categoryId?: string;
}
export class StoreSettingsDto {
  @IsBoolean() enabled!: boolean;
  @IsBoolean() registrationEnabled!: boolean;
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
export class StorePublishDto {
  @IsBoolean() visible!: boolean;
}
export class StoreAccountStatusDto {
  @IsBoolean() suspended!: boolean;
}
