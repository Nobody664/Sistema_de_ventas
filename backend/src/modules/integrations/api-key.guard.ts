import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ApiKeysService } from "./api-keys.service";

export const ApiReadScope = (scope: string) =>
  SetMetadata("integration.read-scope", scope);

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly keys: ApiKeysService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const scope = this.reflector.get<string>(
      "integration.read-scope",
      context.getHandler(),
    );
    if (!scope) return false;
    request.integration = await this.keys.authenticate(
      typeof request.headers["x-api-key"] === "string"
        ? request.headers["x-api-key"]
        : undefined,
      scope,
    );
    return true;
  }
}
