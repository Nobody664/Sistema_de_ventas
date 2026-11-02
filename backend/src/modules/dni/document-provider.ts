import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface DniResponse {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  direccion?: string;
  telefono?: string;
}
export interface RucResponse {
  ruc: string;
  nombre: string;
  estado?: string;
  direccion?: string;
  telefono?: string;
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function payload(value: unknown): Record<string, unknown> {
  const root = object(value);
  if (root.success === false || root.status === false)
    throw new NotFoundException("Documento no encontrado por el proveedor");
  return root.data && typeof root.data === "object"
    ? object(root.data)
    : root.result && typeof root.result === "object"
      ? object(root.result)
      : root;
}
function text(row: Record<string, unknown>, keys: string[], max = 240): string {
  for (const key of keys)
    if (typeof row[key] === "string" && (row[key] as string).trim())
      return (row[key] as string)
        .replace(/[\u0000-\u001f]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max);
  return "";
}
function documentMatches(
  row: Record<string, unknown>,
  keys: string[],
  expected: string,
) {
  for (const key of keys) {
    const value = row[key];
    if (value === undefined || value === null || value === "") continue;
    const normalized =
      typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? String(value).padStart(expected.length, "0")
        : String(value).trim();
    if (normalized !== expected)
      throw new BadGatewayException("El proveedor devolvió otro documento");
    return;
  }
}

export function normalizeDni(value: unknown, dni: string): DniResponse {
  const row = payload(value);
  documentMatches(
    row,
    ["dni", "document_number", "numero_documento", "numeroDocumento"],
    dni,
  );
  const first = text(row, ["nombres", "first_name", "firstName", "nombre"]);
  const surname = text(row, [
    "apellidoPaterno",
    "apellido_paterno",
    "first_last_name",
    "primerApellido",
  ]);
  const second = text(row, [
    "apellidoMaterno",
    "apellido_materno",
    "second_last_name",
    "segundoApellido",
  ]);
  const full = first
    ? [first, surname, second].filter(Boolean).join(" ")
    : text(
        row,
        ["nombreCompleto", "nombre_completo", "full_name", "fullName"],
        500,
      );
  if (!full)
    throw new BadGatewayException(
      "El proveedor DNI no devolvió nombres válidos",
    );
  return {
    dni,
    nombres: first || full,
    apellidoPaterno: first ? surname : "",
    apellidoMaterno: first ? second : "",
    nombreCompleto: full,
    ...(text(row, ["direccion", "dirección", "address"], 500)
      ? { direccion: text(row, ["direccion", "dirección", "address"], 500) }
      : {}),
    ...(text(row, ["telefono", "phone"], 40)
      ? { telefono: text(row, ["telefono", "phone"], 40) }
      : {}),
  };
}

export function normalizeRuc(value: unknown, ruc: string): RucResponse {
  const row = payload(value);
  documentMatches(
    row,
    ["ruc", "numero_documento", "document_number", "numeroDocumento"],
    ruc,
  );
  const nombre = text(
    row,
    [
      "nombre",
      "razon_social",
      "razonSocial",
      "nombre_o_razon_social",
      "business_name",
    ],
    500,
  );
  if (!nombre)
    throw new BadGatewayException(
      "El proveedor RUC no devolvió una razón social válida",
    );
  return {
    ruc,
    nombre,
    estado: text(row, ["estado", "status"]) || undefined,
    direccion:
      text(row, ["direccion", "dirección", "address"], 500) || undefined,
    telefono: text(row, ["telefono", "phone"], 40) || undefined,
  };
}

export function documentRequest(
  config: ConfigService,
  kind: "DNI" | "RUC",
  document: string,
) {
  const prefix = kind === "DNI" ? "RENIEC" : "SUNAT";
  const base =
    config.get<string>(`${prefix}_API_URL`) ||
    `https://api.decolecta.com/v1/${kind === "DNI" ? "reniec/dni" : "sunat/ruc"}`;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new ServiceUnavailableException(
      `Configura una URL válida para ${prefix}`,
    );
  }
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw new ServiceUnavailableException(
      `El proveedor ${prefix} debe usar HTTPS sin credenciales en la URL`,
    );
  const token = (
    config.get<string>(`${prefix}_API_TOKEN`) ??
    (kind === "RUC" ? config.get<string>("RENIEC_API_TOKEN") : "") ??
    ""
  ).trim();
  if (url.hostname === "api.decolecta.com" && !token)
    throw new ServiceUnavailableException(
      `Falta el token de consulta ${prefix} en el backend`,
    );
  const query =
    config.get<string>(`${prefix}_QUERY_PARAM`) ??
    (url.hostname === "api.decolecta.com" ? "numero" : "");
  if (query) {
    if (!/^[A-Za-z_][\w.-]{0,63}$/.test(query))
      throw new ServiceUnavailableException("Parámetro de consulta inválido");
    url.searchParams.set(query, document);
  } else url.pathname = `${url.pathname.replace(/\/$/, "")}/${document}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    const header =
      config.get<string>(`${prefix}_AUTH_HEADER`) || "Authorization";
    const tokenPrefix =
      config.get<string>(`${prefix}_TOKEN_PREFIX`) ?? "Bearer";
    if (
      !/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(header) ||
      ["host", "cookie", "connection", "content-length"].includes(
        header.toLowerCase(),
      ) ||
      /[\r\n]/.test(tokenPrefix) ||
      tokenPrefix.length > 40
    )
      throw new ServiceUnavailableException(
        "Configuración de autenticación del proveedor inválida",
      );
    headers[header] = tokenPrefix ? `${tokenPrefix.trim()} ${token}` : token;
  }
  const timeout = Number(
    config.get<number | string>(`${prefix}_TIMEOUT_MS`) ??
      (kind === "DNI" ? 10000 : 15000),
  );
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30000)
    throw new ServiceUnavailableException(
      "Timeout del proveedor fuera de rango",
    );
  return { url: url.toString(), headers, timeout };
}
