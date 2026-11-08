import { applyDecorators } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsEmail, IsString, Length, Matches } from "class-validator";

export const STORE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
export const STORE_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,511}$/;
export const STORE_PHONE_PATTERN = /^(?=(?:\D*\d){7,})\+?[0-9 ()-]{7,20}$/;

export function StoreText(
  min: number,
  max: number,
  multiline = false,
): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === "string" ? value.trim() : value,
    ),
    IsString(),
    Length(min, max),
    Matches(
      multiline
        ? /^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/
        : /^[^<>\u0000-\u001f\u007f]*$/,
      {
        message:
          "$property debe contener texto sin etiquetas ni caracteres de control",
      },
    ),
  );
}

export function StoreEmail(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === "string" ? value.trim().toLowerCase() : value,
    ),
    IsString(),
    IsEmail(),
    Length(3, 200),
  );
}

export function StoreIdentifier(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Matches(STORE_IDENTIFIER_PATTERN, {
      message: "$property no es un identificador válido",
    }),
  );
}
