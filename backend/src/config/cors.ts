import { ForbiddenException } from "@nestjs/common";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

export function createCorsOptions(
  configuredOrigins: string | undefined,
  onBlocked: (origin: string) => void,
): CorsOptions {
  const allowedOrigins = new Set([
    ...(configuredOrigins || "http://localhost:3000,http://localhost:3001")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    "https://sistema-de-ventas-frontend-seven.vercel.app",
    "https://ventas.qorium-investment.qpon",
  ]);

  return {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      onBlocked(origin);
      return callback(new ForbiddenException("Origen no autorizado"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  };
}
