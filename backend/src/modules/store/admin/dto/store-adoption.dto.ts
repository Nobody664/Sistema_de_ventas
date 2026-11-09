import { IsBoolean, IsInt, Min, Max, IsIn } from "class-validator";

export class StoreExperienceDto {
  @IsInt() @Min(0) expectedVersion!: number;
  @IsBoolean() enabled!: boolean;
}
export class StoreFormEventDto {
  @IsIn(["FORM_OPENED", "FORM_SAVED", "FORM_ABANDONED"]) event!: string;
  @IsIn(["CONFIGURATION", "ORDER_ACTION", "APPEARANCE", "NOTE", "VIEW"])
  form!: string;
  @IsInt() @Min(0) @Max(86400000) elapsedMs!: number;
}
