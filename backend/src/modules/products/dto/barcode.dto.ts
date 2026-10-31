import { IsString, MaxLength, MinLength } from "class-validator";

export class BarcodeCodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;
}
