import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { isEmail } from "class-validator";
import { emailSettings } from "./email-settings";

export class EmailTransportError extends Error {
  constructor(
    public readonly code: string,
    public readonly status?: number,
  ) {
    super(`Correo no aceptado: ${code}${status ? ` (HTTP ${status})` : ""}`);
  }
}

export interface EmailReceipt {
  provider: "smtp" | "resend";
  messageId: string;
  accepted: true;
}

@Injectable()
export class EmailTransportService {
  constructor(private readonly config: ConfigService) {}

  status() {
    const settings = emailSettings(this.config);
    return {
      enabled: settings.enabled,
      provider: settings.provider,
      configured: settings.issues.length === 0,
      senderDomain: settings.address.split("@")[1] ?? null,
      smtpHost: settings.provider === "smtp" ? settings.host : null,
      smtpPort: settings.provider === "smtp" ? settings.port : null,
      resendKeyConfigured: !!settings.apiKey,
      issues: settings.issues,
      transportNote:
        "Aceptado por el proveedor no equivale a entrega en la bandeja del destinatario.",
    };
  }

  private settings() {
    const settings = emailSettings(this.config);
    if (!settings.enabled)
      throw new ServiceUnavailableException(
        "El envío de correo está deshabilitado",
      );
    if (settings.issues.length)
      throw new ServiceUnavailableException(settings.issues.join(". "));
    return settings;
  }

  private smtp(settings: ReturnType<typeof emailSettings>) {
    return nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      requireTLS: !settings.secure,
      tls: { minVersion: "TLSv1.2" },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 30000,
      auth: { user: settings.user, pass: settings.password },
    });
  }

  async verify() {
    const settings = this.settings();
    if (settings.provider === "smtp") {
      const transport = this.smtp(settings);
      try {
        await transport.verify();
        return {
          provider: "smtp",
          connectionVerified: true,
          note: "Conexión y autenticación verificadas; todavía no se envió ningún mensaje.",
        };
      } catch (error) {
        throw new EmailTransportError(this.smtpCode(error));
      } finally {
        transport.close();
      }
    }
    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${settings.apiKey}` },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    const body = (await response.json().catch(() => null)) as {
      name?: string;
      message?: string;
      data?: { name: string; status: string }[];
    } | null;
    if (!response.ok) {
      if (body?.name === "restricted_api_key")
        return {
          provider: "resend",
          connectionVerified: true,
          authentication: "restricted_key",
          senderVerified: null,
          note: "Resend reconoce una clave restringida; su permiso de envío y remitente se validan enviando la prueba.",
        };
      throw new EmailTransportError(
        this.resendCode(body?.name, body?.message),
        response.status,
      );
    }
    const domain = body?.data?.find(
      (domain) => domain.name === settings.address.split("@")[1],
    );
    return {
      provider: "resend",
      connectionVerified: true,
      authentication: "verified",
      senderVerified: domain?.status === "verified",
      domains:
        body?.data?.map((domain) => ({
          name: domain.name,
          status: domain.status,
        })) ?? [],
      note: "Conectividad y consulta de dominios verificadas. No se envió ningún mensaje.",
    };
  }

  async send(input: {
    to: string;
    subject: string;
    text: string;
    messageId?: string;
  }): Promise<EmailReceipt> {
    const settings = this.settings();
    if (
      !isEmail(input.to) ||
      /[\r\n]/.test(input.to) ||
      /[\r\n]/.test(input.subject) ||
      (input.messageId && /[\r\n]/.test(input.messageId))
    )
      throw new BadRequestException(
        "Destinatario o cabeceras de correo inválidos",
      );
    const messageId =
      input.messageId ?? `<${randomUUID()}@notifications.ventas>`;
    const idempotencyKey = `email/${createHash("sha256").update(messageId).digest("hex")}`;
    if (settings.provider === "smtp") {
      const transport = this.smtp(settings);
      try {
        const receipt = await transport.sendMail({
          from: { address: settings.address, name: settings.name },
          to: input.to,
          subject: input.subject,
          text: input.text,
          messageId,
          ...(settings.host === "smtp.resend.com"
            ? { headers: { "Resend-Idempotency-Key": idempotencyKey } }
            : {}),
        });
        if (!receipt.accepted?.length || receipt.rejected?.length)
          throw new EmailTransportError("SMTP_RECIPIENT_REJECTED");
        return {
          provider: "smtp",
          messageId: receipt.messageId,
          accepted: true,
        };
      } catch (error) {
        if (error instanceof EmailTransportError) throw error;
        throw new EmailTransportError(this.smtpCode(error));
      } finally {
        transport.close();
      }
    }
    let response: Response;
    try {
      response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          from: settings.name
            ? `${settings.name} <${settings.address}>`
            : settings.address,
          to: [input.to],
          subject: input.subject,
          text: input.text,
          headers: { "Message-ID": messageId },
        }),
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new EmailTransportError("RESEND_CONNECTION_FAILED");
    }
    const body = (await response.json().catch(() => null)) as {
      id?: string;
      name?: string;
      message?: string;
    } | null;
    if (!response.ok)
      throw new EmailTransportError(
        this.resendCode(body?.name, body?.message),
        response.status,
      );
    if (typeof body?.id !== "string" || !body.id)
      throw new EmailTransportError("RESEND_INVALID_RESPONSE");
    return { provider: "resend", messageId: body.id, accepted: true };
  }

  private smtpCode(error: unknown): string {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : "UNKNOWN";
    return /^[A-Z0-9_]{1,40}$/.test(code) ? `SMTP_${code}` : "SMTP_FAILED";
  }
  private resendCode(name?: string, message?: string): string {
    if (message && /associated domain.*not verified/i.test(message))
      return "RESEND_KEY_DOMAIN_UNVERIFIED";
    if (message && /domain.*not verified/i.test(message))
      return "RESEND_SENDER_DOMAIN_UNVERIFIED";
    if (message && /only send testing emails/i.test(message))
      return "RESEND_TEST_RECIPIENT_RESTRICTED";
    return name && /^[a-z_]{1,60}$/.test(name)
      ? `RESEND_${name.toUpperCase()}`
      : "RESEND_REJECTED";
  }
}
