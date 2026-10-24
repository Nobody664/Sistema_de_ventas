import { BadRequestException, Injectable, PipeTransform } from "@nestjs/common";

@Injectable()
export class EntityIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value))
      throw new BadRequestException("Identificador inválido");
    return value;
  }
}
