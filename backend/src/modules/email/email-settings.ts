import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";

export function emailEnabled(config: ConfigService): boolean {
  const flag =
    config.get<unknown>("EMAIL_ENABLED") ?? config.get<unknown>("SMTP_ENABLED");
  return (
    flag === true ||
    (typeof flag === "string" &&
      ["true", "1", "yes", "on"].includes(flag.trim().toLowerCase()))
  );
}

export function emailSettings(config: ConfigService) {
  const requested = (
    config.get<string>("EMAIL_PROVIDER") ?? "auto"
  ).toLowerCase();
  const apiKey = config.get<string>("RESEND_API_KEY")?.trim() ?? "";
  const provider =
    requested === "auto" ? (apiKey ? "resend" : "smtp") : requested;
  const address = (
    config.get<string>("EMAIL_FROM_EMAIL") ??
    (provider === "resend"
      ? config.get<string>("RESEND_FROM_EMAIL")
      : undefined) ??
    config.get<string>("SMTP_FROM_EMAIL") ??
    ""
  ).trim();
  const name = (
    config.get<string>("EMAIL_FROM_NAME") ??
    config.get<string>("SMTP_FROM_NAME") ??
    ""
  ).trim();
  const host = config.get<string>("SMTP_HOST")?.trim() ?? "";
  const port = Number(config.get<number | string>("SMTP_PORT") ?? 587);
  const secureFlag = config.get<unknown>("SMTP_SECURE");
  const secure =
    secureFlag === undefined
      ? [465, 2465].includes(port)
      : secureFlag === true || secureFlag === "true";
  const user = config.get<string>("SMTP_USER") ?? "";
  const password = config.get<string>("SMTP_PASSWORD") ?? "";
  const issues: string[] = [];
  if (!["smtp", "resend"].includes(provider))
    issues.push("EMAIL_PROVIDER debe ser auto, smtp o resend");
  if (!isEmail(address) || /[\r\n]/.test(address))
    issues.push(
      "Define un remitente válido en EMAIL_FROM_EMAIL, RESEND_FROM_EMAIL o SMTP_FROM_EMAIL",
    );
  if (/[\r\n<>]/.test(name))
    issues.push("El nombre del remitente contiene caracteres inválidos");
  if (provider === "resend" && !apiKey) issues.push("Falta RESEND_API_KEY");
  if (provider === "smtp") {
    if (!host) issues.push("Falta SMTP_HOST");
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      issues.push("SMTP_PORT no es válido");
    if (!user || !password)
      issues.push("Faltan credenciales SMTP_USER/SMTP_PASSWORD");
  }
  return {
    enabled: emailEnabled(config),
    provider: provider as "smtp" | "resend",
    address,
    name,
    apiKey,
    host,
    port,
    secure,
    user,
    password,
    issues,
  };
}
