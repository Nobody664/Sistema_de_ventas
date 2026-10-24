import {
  IsDateString,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class ConfirmSubscriptionPaymentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsDateString()
  paymentDate?: string;
}
