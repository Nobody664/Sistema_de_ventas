import { Injectable, Logger, NestMiddleware, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NextFunction, Request, Response } from "express";

@Injectable()
export class StoreAdminTelemetryMiddleware implements NestMiddleware {
  private readonly logger = new Logger(StoreAdminTelemetryMiddleware.name);
  constructor(@Optional() private readonly config?: ConfigService) {}
  use(
    request: Request & { user?: { companyId?: string | null } },
    response: Response,
    next: NextFunction,
  ): void {
    if (this.config?.get<string>("STORE_ADMIN_TELEMETRY") !== "true") {
      next();
      return;
    }
    const start = performance.now();
    let logged = false;
    const log = (aborted: boolean) => {
      if (logged) return;
      logged = true;
      this.logger.log(
        JSON.stringify({
          event: "store_admin_http",
          route:
            typeof request.route?.path === "string"
              ? request.route.path
              : "/store-admin/*",
          method: request.method,
          status: aborted ? 499 : response.statusCode,
          durationMs: Math.round((performance.now() - start) * 100) / 100,
          companyId: request.user?.companyId ?? null,
        }),
      );
    };
    response.once("finish", () => log(false));
    response.once("close", () => log(!response.writableFinished));
    next();
  }
}
