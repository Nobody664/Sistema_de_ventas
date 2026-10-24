import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MercadoPagoConfig, Preference } from "mercadopago";

export interface MercadoPagoCheckoutInput {
  planCode: string;
  planName: string;
  amount: number;
  email: string;
  reference: string;
  paymentId: string;
  notificationUrl: string;
  returnUrl: string;
}

export interface MercadoPagoPayment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  collectorId: string;
  reference: string | null;
  paidAt: Date | null;
  liveMode: boolean;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function identifier(value: unknown): string | null {
  if (typeof value === "string" && /^[a-zA-Z0-9-]{1,128}$/.test(value))
    return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
    return String(value);
  return null;
}

@Injectable()
export class MercadoPagoGateway {
  private merchant: { id: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  async createPreference(
    input: MercadoPagoCheckoutInput,
  ): Promise<{ id: string; redirectUrl: string }> {
    const token = this.config.get<string>("MERCADOPAGO_ACCESS_TOKEN");
    if (!token)
      throw new ServiceUnavailableException(
        "Proveedor de pagos no configurado",
      );
    const preference = new Preference(
      new MercadoPagoConfig({ accessToken: token, options: { timeout: 6000 } }),
    );
    const result = await preference.create({
      body: {
        items: [
          {
            id: input.planCode,
            title: `Suscripción ${input.planName} - Huanka-Saas`,
            quantity: 1,
            unit_price: input.amount,
            currency_id: "PEN",
          },
        ],
        payer: { email: input.email },
        external_reference: input.reference,
        notification_url: input.notificationUrl,
        back_urls: {
          success: input.returnUrl,
          pending: input.returnUrl,
          failure: input.returnUrl,
        },
        statement_descriptor: "HUANKA SAAS",
        metadata: { paymentId: input.paymentId },
      },
    });
    if (
      typeof result.id !== "string" ||
      !result.id ||
      typeof result.init_point !== "string"
    )
      throw new BadGatewayException("Preferencia de pago incompleta");
    const url = new URL(result.init_point);
    const domains = [
      "mercadopago.com",
      "mercadopago.com.pe",
      "mercadopago.com.ar",
      "mercadopago.com.br",
      "mercadopago.com.mx",
      "mercadopago.com.co",
      "mercadopago.com.uy",
      "mercadopago.cl",
    ];
    if (
      url.protocol !== "https:" ||
      !domains.some(
        (domain) =>
          url.hostname === domain || url.hostname.endsWith(`.${domain}`),
      )
    )
      throw new BadGatewayException("Destino de pago inválido");
    return { id: result.id, redirectUrl: result.init_point };
  }

  async getPayment(id: string): Promise<MercadoPagoPayment> {
    if (!identifier(id))
      throw new BadGatewayException("Identificador del proveedor inválido");
    const value = await this.get(`/v1/payments/${encodeURIComponent(id)}`);
    if (!record(value))
      throw new BadGatewayException("Respuesta de pago inválida");
    const paymentId = identifier(value.id);
    const collectorId = identifier(value.collector_id);
    const paidAt =
      typeof value.date_approved === "string"
        ? new Date(value.date_approved)
        : null;
    if (
      !paymentId ||
      !collectorId ||
      typeof value.status !== "string" ||
      typeof value.transaction_amount !== "number" ||
      !Number.isFinite(value.transaction_amount) ||
      value.transaction_amount < 0 ||
      typeof value.currency_id !== "string" ||
      !/^[A-Z]{3}$/.test(value.currency_id) ||
      typeof value.live_mode !== "boolean" ||
      (value.external_reference !== null &&
        value.external_reference !== undefined &&
        typeof value.external_reference !== "string") ||
      (value.status === "approved" &&
        (!paidAt || Number.isNaN(paidAt.getTime())))
    ) {
      throw new BadGatewayException(
        "Respuesta de pago incompleta del proveedor",
      );
    }
    return {
      id: paymentId,
      collectorId,
      status: value.status,
      amount: value.transaction_amount,
      currency: value.currency_id,
      reference:
        typeof value.external_reference === "string"
          ? value.external_reference
          : null,
      paidAt,
      liveMode: value.live_mode,
    };
  }

  async getMerchantId(): Promise<string> {
    if (this.merchant && this.merchant.expiresAt > Date.now())
      return this.merchant.id;
    const value = await this.get("/users/me");
    const id = record(value) ? identifier(value.id) : null;
    if (!id)
      throw new BadGatewayException(
        "No se pudo verificar el beneficiario del pago",
      );
    this.merchant = { id, expiresAt: Date.now() + 5 * 60_000 };
    return id;
  }

  private async get(path: string): Promise<unknown> {
    const token = this.config.get<string>("MERCADOPAGO_ACCESS_TOKEN");
    if (!token)
      throw new ServiceUnavailableException(
        "Proveedor de pagos no configurado",
      );
    try {
      const response = await fetch(`https://api.mercadopago.com${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok)
        throw new BadGatewayException(
          "No se pudo verificar el pago con el proveedor",
        );
      return (await response.json()) as unknown;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        "El proveedor no respondió una verificación válida",
      );
    }
  }
}
