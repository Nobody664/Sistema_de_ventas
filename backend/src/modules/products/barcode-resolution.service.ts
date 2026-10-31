import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "@/database/prisma/prisma.service";
import {
  barcodeLookupCandidates,
  toGtin14,
} from "@/common/helpers/barcode.helper";
import { PlanCapabilitiesService } from "@/modules/plan-capabilities/plan-capabilities.service";
import { ProductsService } from "./products.service";

export interface BarcodeSuggestion {
  name: string;
  brand?: string;
  quantity?: string;
  description?: string;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  return (
    value
      .replace(/[\u0000-\u001f<>]/g, "")
      .trim()
      .slice(0, max) || undefined
  );
}

function suggestion(value: unknown): BarcodeSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const product = value as Record<string, unknown>;
  const name =
    text(product.product_name_es, 160) ?? text(product.product_name, 160);
  if (!name) return null;
  const brand = text(product.brands, 120);
  const quantity = text(product.quantity, 80);
  return {
    name,
    brand,
    quantity,
    description: [brand, quantity].filter(Boolean).join(" · ") || undefined,
  };
}

@Injectable()
export class BarcodeResolutionService {
  private readonly logger = new Logger(BarcodeResolutionService.name);
  private readonly pending = new Map<
    string,
    Promise<BarcodeSuggestion | null>
  >();
  private nextRequestAt = 0;

  constructor(
    private readonly products: ProductsService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly capabilities: PlanCapabilitiesService,
  ) {}

  async resolve(companyId: string, code: string) {
    const product = await this.products.findByBarcode(companyId, code);
    if (product)
      return { source: "catalog" as const, product, suggestion: null };
    const gtin = toGtin14(code.trim());
    if (!gtin)
      return {
        source: "none" as const,
        product: null,
        suggestion: null,
        reason: "invalid",
      };
    if (!(await this.enabled(companyId))) {
      return {
        source: "none" as const,
        product: null,
        suggestion: null,
        reason: "disabled",
      };
    }
    try {
      const cached = await this.prisma.barcodeLookupCache.findUnique({
        where: { gtin_provider: { gtin, provider: "openfoodfacts" } },
      });
      if (cached && cached.expiresAt > new Date()) {
        return {
          source: "cache" as const,
          provider: "openfoodfacts",
          product: null,
          suggestion: suggestion(cached.payload),
          fetchedAt: cached.fetchedAt,
        };
      }
      let request = this.pending.get(gtin);
      if (!request) {
        if (Date.now() < this.nextRequestAt) {
          return {
            source: "none" as const,
            product: null,
            suggestion: null,
            reason: "busy",
          };
        }
        this.nextRequestAt = Date.now() + 1100;
        request = this.fetchProduct(gtin);
        this.pending.set(gtin, request);
      }
      try {
        const found = await request;
        return {
          source: "openfoodfacts" as const,
          provider: "openfoodfacts",
          product: null,
          suggestion: found,
        };
      } finally {
        if (this.pending.get(gtin) === request) this.pending.delete(gtin);
      }
    } catch {
      this.logger.warn(
        "La consulta de código externo no está disponible temporalmente",
      );
      return {
        source: "none" as const,
        product: null,
        suggestion: null,
        reason: "unavailable",
      };
    }
  }

  private async enabled(companyId: string): Promise<boolean> {
    const flag = this.config.get<boolean | string>(
      "BARCODE_ENRICHMENT_ENABLED",
    );
    if (flag !== true && flag !== "true") return false;
    const companies = this.list("BARCODE_ENRICHMENT_COMPANY_IDS");
    const plans = this.list("BARCODE_ENRICHMENT_PLAN_CODES");
    if (!companies.length && !plans.length) return true;
    if (companies.includes(companyId)) return true;
    if (!plans.length) return false;
    const capabilities = await this.capabilities.getCapabilities(companyId);
    return plans.includes(capabilities.planCode);
  }

  private list(key: string): string[] {
    return (this.config.get<string>(key) ?? "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private async fetchProduct(gtin: string): Promise<BarcodeSuggestion | null> {
    const code = barcodeLookupCandidates(gtin)
      .filter((value) => [8, 12, 13, 14].includes(value.length))
      .sort((a, b) => a.length - b.length)[0];
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,product_name_es,brands,quantity`,
      {
        headers: {
          "User-Agent": "SistemaDeVentas/1.0 (barcode product lookup)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(2000),
        redirect: "error",
      },
    );
    if (!response.ok && response.status !== 404)
      throw new Error("Provider unavailable");
    let payload: Record<string, string> = {};
    if (response.ok) {
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Empty provider body");
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 65536) throw new Error("Provider body too large");
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!body || typeof body !== "object")
        throw new Error("Invalid provider body");
      const data = body as Record<string, unknown>;
      if (data.status !== 0 && data.status !== 1)
        throw new Error("Invalid provider status");
      if (
        data.status === 1 &&
        data.product &&
        typeof data.product === "object"
      ) {
        const found = suggestion(data.product);
        if (found)
          payload = {
            product_name: found.name,
            brands: found.brand ?? "",
            quantity: found.quantity ?? "",
          };
      }
    }
    const found = suggestion(payload);
    const fetchedAt = new Date();
    const data = {
      payload,
      fetchedAt,
      expiresAt: new Date(fetchedAt.getTime() + (found ? 86400000 : 3600000)),
    };
    await this.prisma.barcodeLookupCache.upsert({
      where: { gtin_provider: { gtin, provider: "openfoodfacts" } },
      create: { gtin, provider: "openfoodfacts", ...data },
      update: data,
    });
    return found;
  }
}
