import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { Observable } from "rxjs";
import { STORE_ACCESS_KEY } from "../decorators/store-access.decorator";
import { StoreAuthGuard } from "./store-auth.guard";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(
    private reflector: Reflector,
    @Optional() private readonly storeGuard?: StoreAuthGuard,
  ) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    if (
      this.reflector.getAllAndOverride<boolean>(STORE_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      if (!this.storeGuard)
        throw new UnauthorizedException("Sesión comercial no disponible");
      return this.storeGuard.canActivate(context);
    }

    return super.canActivate(context);
  }

  handleRequest<TUser = any>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return (user ?? true) as TUser;
    }

    if (err || !user) {
      throw err || new UnauthorizedException("No autorizado");
    }
    return user;
  }
}
