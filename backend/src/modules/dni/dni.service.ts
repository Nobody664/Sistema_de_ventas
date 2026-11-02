import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "@/cache/cache.service";
import { ApiQuotaService } from "@/modules/plan-capabilities/api-quota.service";
import {
  documentRequest,
  DniResponse,
  normalizeDni,
  normalizeRuc,
  RucResponse,
} from "./document-provider";

export type { DniResponse, RucResponse } from "./document-provider";

@Injectable()
export class DniService {
  private readonly pending = new Map<string, Promise<unknown>>();
  constructor(
    private readonly config: ConfigService,
    private readonly cache: CacheService,
    private readonly quota: ApiQuotaService,
  ) {}
  async findByDni(dni: string, companyId: string | null): Promise<DniResponse> {
    if (!/^\d{8}$/.test(dni))
      throw new BadRequestException("DNI debe tener 8 dígitos");
    return this.lookup("DNI", dni, companyId, normalizeDni);
  }
  async findByRuc(ruc: string, companyId: string | null): Promise<RucResponse> {
    if (!/^\d{11}$/.test(ruc))
      throw new BadRequestException("RUC debe tener 11 dígitos");
    return this.lookup("RUC", ruc, companyId, normalizeRuc);
  }
  private async lookup<T>(
    kind: "DNI" | "RUC",
    document: string,
    companyId: string | null,
    normalize: (value: unknown, document: string) => T,
  ): Promise<T> {
    if (!companyId)
      throw new ForbiddenException(
        "Se requiere una empresa para consultar documentos",
      );
    await this.quota.assertDniAccess(companyId);
    const key = `document:v2:${kind}:${document}`;
    const cached = await this.cache.get<unknown>(key);
    if (cached) {
      try {
        return normalize(cached, document);
      } catch {}
    }
    const pendingKey = `${companyId}:${key}`;
    const existing = this.pending.get(pendingKey);
    if (existing) return (await existing) as T;
    const request = this.query(kind, document, companyId, normalize, key);
    this.pending.set(pendingKey, request);
    try {
      return await request;
    } finally {
      if (this.pending.get(pendingKey) === request)
        this.pending.delete(pendingKey);
    }
  }
  private async query<T>(
    kind: "DNI" | "RUC",
    document: string,
    companyId: string,
    normalize: (value: unknown, document: string) => T,
    key: string,
  ): Promise<T> {
    const request = documentRequest(this.config, kind, document);
    await this.quota.consume(companyId);
    try {
      const response = await fetch(request.url, {
        headers: request.headers,
        redirect: "error",
        signal: AbortSignal.timeout(request.timeout),
      });
      if (response.status === 404)
        throw new NotFoundException(`${kind} no encontrado`);
      if ([401, 403].includes(response.status))
        throw new ServiceUnavailableException(
          "El proveedor de documentos rechazó las credenciales del servidor",
        );
      if (response.status === 429)
        throw new ServiceUnavailableException(
          "El proveedor de documentos alcanzó su límite. Intenta más tarde.",
        );
      if (!response.ok)
        throw new BadGatewayException(
          `El proveedor ${kind} no está disponible`,
        );
      const data: unknown = await response.json();
      const result = normalize(data, document);
      await this.cache.set(key, result, 86400);
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        error instanceof Error &&
        ["AbortError", "TimeoutError"].includes(error.name)
      )
        throw new GatewayTimeoutException(
          `Tiempo de conexión agotado con el proveedor ${kind}`,
        );
      throw new BadGatewayException(
        `No se pudo consultar el proveedor ${kind}`,
      );
    }
  }
}
