import { BadGatewayException, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { IncomingHttpHeaders } from "node:http";

export function storeWebhookId(
  secret: string,
  headers: IncomingHttpHeaders,
  query: Record<string, unknown>,
): string {
  const signature = headers["x-signature"];
  const request = headers["x-request-id"];
  const nested =
    query.data && typeof query.data === "object"
      ? (query.data as Record<string, unknown>).id
      : undefined;
  const id = query["data.id"] ?? nested;
  if (
    !secret ||
    typeof signature !== "string" ||
    typeof request !== "string" ||
    !/^[\w-]{1,128}$/.test(request) ||
    typeof id !== "string" ||
    !/^\d{1,128}$/.test(id) ||
    (nested !== undefined &&
      query["data.id"] !== undefined &&
      nested !== query["data.id"])
  )
    throw new UnauthorizedException("Firma de pago inválida");
  const parts = Object.fromEntries(
    signature.split(",").map((part) => part.trim().split("=")),
  );
  if (
    !/^\d{10}(\d{3})?$/.test(parts.ts ?? "") ||
    !/^[a-fA-F0-9]{64}$/.test(parts.v1 ?? "") ||
    Math.abs(
      Date.now() - Number(parts.ts) * (parts.ts.length === 10 ? 1000 : 1),
    ) > 600000
  )
    throw new UnauthorizedException("Firma de pago expirada o inválida");
  const expected = createHmac("sha256", secret)
    .update(`id:${id};request-id:${request};ts:${parts.ts};`)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(parts.v1, "hex")))
    throw new UnauthorizedException("Firma de pago inválida");
  return id;
}

export function storeRedirect(value: unknown): string {
  if (typeof value !== "string")
    throw new BadGatewayException("Destino de pago ausente");
  const url = new URL(value);
  const hosts = [
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
    url.username ||
    url.password ||
    !hosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
  )
    throw new BadGatewayException("Destino de pago no permitido");
  return url.toString();
}

export function gatewayRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadGatewayException("Respuesta del proveedor inválida");
  return value as Record<string, unknown>;
}
