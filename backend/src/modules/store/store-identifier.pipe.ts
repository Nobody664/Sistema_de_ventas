import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { STORE_IDENTIFIER_PATTERN } from "./dto/store-validation";

@Injectable()
export class StoreIdentifierPipe implements PipeTransform<unknown, string> {
  transform(value: unknown): string {
    if (typeof value !== "string" || !STORE_IDENTIFIER_PATTERN.test(value))
      throw new BadRequestException(
        "Identificador de tienda o recurso inválido",
      );
    return value;
  }
}
