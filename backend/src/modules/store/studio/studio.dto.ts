import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { StoreText } from "../dto/store-validation";

export class StudioVersionDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
export class StudioFeaturesDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsBoolean() appearance!: boolean;
  @IsBoolean() notes!: boolean;
  @IsBoolean() savedViews!: boolean;
}
export class StudioDraftDto {
  @IsInt() @Min(1) expectedDraftVersion!: number;
  @IsObject() draft!: Record<string, unknown>;
}
export class StudioPublishDto {
  @IsInt() @Min(1) expectedDraftVersion!: number;
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  expectedPublishedVersion!: number | null;
}
export class StudioMediaDto {
  @IsIn(["LOGO", "HERO"]) purpose!: "LOGO" | "HERO";
  @IsString() @MaxLength(2_000_000) image!: string;
}
export class StudioNoteDto {
  @StoreText(1, 2000, true) body!: string;
}
export class StudioViewsQuery {
  @IsIn(["ORDERS", "CATALOG", "CUSTOMERS"]) resource!: string;
}
export class StudioViewDto extends StudioViewsQuery {
  @StoreText(1, 80) name!: string;
  @IsObject() definition!: Record<string, unknown>;
  @IsBoolean() isDefault!: boolean;
}
export class StudioViewUpdateDto extends StudioViewDto {
  @IsInt() @Min(1) expectedVersion!: number;
}
