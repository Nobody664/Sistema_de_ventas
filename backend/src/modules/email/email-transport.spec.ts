import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { ConfigService } from "@nestjs/config";
import nodemailer from "nodemailer";
import { EmailTransportService } from "./email-transport.service";
import { EmailService, EmailTemplate } from "./email.service";
import { emailEnabled } from "./email-settings";
import { validateEnv } from "@/config/env";

const settings = {
  SMTP_ENABLED: true,
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "private-test-key",
  SMTP_FROM_EMAIL: "alerts@example.test",
  SMTP_FROM_NAME: "Ventas",
};
const message = {
  to: "recipient@example.test",
  subject: "Prueba",
  text: "Contenido",
  messageId: "<one@notifications.test>",
};

test("la validación conserva Resend y los flags nuevos sin romper SMTP_ENABLED", () => {
  const env = validateEnv({
    DATABASE_URL: "postgresql://example.test/db",
    JWT_ACCESS_SECRET: "test-access-secret",
    JWT_REFRESH_SECRET: "test-refresh-secret",
    ...settings,
  });
  assert.equal(env.EMAIL_PROVIDER, "resend");
  assert.equal(env.RESEND_API_KEY, "private-test-key");
  assert.equal(env.EMAIL_ENABLED, undefined);
  assert.equal(emailEnabled(new ConfigService(env)), true);
  assert.equal(
    emailEnabled(
      new ConfigService({ SMTP_ENABLED: true, EMAIL_ENABLED: false }),
    ),
    false,
  );
  assert.equal(
    emailEnabled(
      new ConfigService({ SMTP_ENABLED: false, EMAIL_ENABLED: true }),
    ),
    true,
  );
});

test("Resend usa HTTPS e idempotencia, preserva destinatario y no intenta SMTP", async (t) => {
  const calls: RequestInit[] = [];
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init: RequestInit) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(init.redirect, "error");
      assert.ok(init.signal instanceof AbortSignal);
      calls.push(init);
      return Response.json({ id: "provider-message-id" });
    },
  );
  const smtp = t.mock.method(nodemailer, "createTransport", () => {
    throw new Error("SMTP no debe ejecutarse");
  });
  const transport = new EmailTransportService(new ConfigService(settings));
  const receipt = await transport.send(message);
  await transport.send(message);
  await transport.send({ ...message, messageId: "<two@notifications.test>" });
  assert.equal(receipt.accepted, true);
  assert.equal(receipt.provider, "resend");
  assert.equal(receipt.messageId, "provider-message-id");
  const body = JSON.parse(String(calls[0].body));
  assert.deepEqual(body.to, [message.to]);
  assert.equal(body.from, "Ventas <alerts@example.test>");
  assert.equal(body.text, message.text);
  const headers = calls.map((call) => new Headers(call.headers));
  assert.equal(headers[0].get("Authorization"), "Bearer private-test-key");
  assert.equal(
    headers[0].get("Idempotency-Key"),
    headers[1].get("Idempotency-Key"),
  );
  assert.notEqual(
    headers[0].get("Idempotency-Key"),
    headers[2].get("Idempotency-Key"),
  );
  assert.equal(fetch.mock.callCount(), 3);
  assert.equal(smtp.mock.callCount(), 0);
  assert.equal(
    JSON.stringify(transport.status()).includes("private-test-key"),
    false,
  );
});

test("rechazos y respuestas malformadas no se marcan como envío aceptado ni filtran errores del proveedor", async (t) => {
  const transport = new EmailTransportService(new ConfigService(settings));
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      { name: "validation_error", message: "private-test-key" },
      { status: 403 },
    ),
  );
  await assert.rejects(
    transport.send(message),
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes("403") &&
      !error.message.includes("private-test-key"),
  );
  assert.equal(fetch.mock.callCount(), 1);
  fetch.mock.restore();
  t.mock.method(globalThis, "fetch", async () => Response.json({}));
  await assert.rejects(transport.send(message), /RESEND_INVALID_RESPONSE/);
});

test("un fallo de red no produce fallback SMTP ni un falso éxito", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("Connection timeout");
  });
  const smtp = t.mock.method(nodemailer, "createTransport", () => {
    throw new Error("No fallback");
  });
  await assert.rejects(
    new EmailTransportService(new ConfigService(settings)).send(message),
    /RESEND_CONNECTION_FAILED/,
  );
  assert.equal(smtp.mock.callCount(), 0);
});

test("un dominio no verificado asociado a la clave produce un diagnóstico específico", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        message: "The associated domain with your API key is not verified.",
        statusCode: 400,
      },
      { status: 400 },
    ),
  );
  await assert.rejects(
    new EmailTransportService(new ConfigService(settings)).send(message),
    /RESEND_KEY_DOMAIN_UNVERIFIED/,
  );
});

test("un correo deshabilitado o con configuración incompleta no inicia conexiones", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("No conexión");
  });
  await assert.rejects(
    new EmailTransportService(
      new ConfigService({ ...settings, EMAIL_ENABLED: false }),
    ).send(message),
  );
  await assert.rejects(
    new EmailTransportService(
      new ConfigService({ ...settings, RESEND_API_KEY: "" }),
    ).send(message),
  );
  await assert.rejects(
    new EmailTransportService(
      new ConfigService({ ...settings, SMTP_FROM_EMAIL: "" }),
    ).send(message),
  );
  assert.equal(fetch.mock.callCount(), 0);
});

test("SMTP reconoce TLS implícito 2465 y STARTTLS 2587 y comprueba aceptación real", async (t) => {
  const options: unknown[] = [];
  let accepted = true;
  let closed = 0;
  t.mock.method(nodemailer, "createTransport", (input: unknown) => {
    options.push(input);
    return {
      verify: async () => true,
      sendMail: async () => ({
        messageId: "smtp-message",
        accepted: accepted ? [message.to] : [],
        rejected: [],
      }),
      close: () => {
        closed++;
      },
    } as never;
  });
  const base = {
    ...settings,
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "smtp.resend.com",
    SMTP_USER: "resend",
    SMTP_PASSWORD: "private-smtp",
  };
  const secure = new EmailTransportService(
    new ConfigService({ ...base, SMTP_PORT: 2465 }),
  );
  assert.equal((await secure.send(message)).provider, "smtp");
  const starttls = new EmailTransportService(
    new ConfigService({ ...base, SMTP_PORT: 2587 }),
  );
  assert.equal((await starttls.verify()).connectionVerified, true);
  assert.equal((options[0] as { secure: boolean }).secure, true);
  assert.equal(
    (options[1] as { secure: boolean; requireTLS: boolean }).secure,
    false,
  );
  assert.equal((options[1] as { requireTLS: boolean }).requireTLS, true);
  accepted = false;
  await assert.rejects(starttls.send(message), /SMTP_RECIPIENT_REJECTED/);
  assert.equal(closed, 3);
});

test("una clave de solo envío se diagnostica como restringida sin afirmar que el remitente está verificado", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ name: "restricted_api_key" }, { status: 401 }),
  );
  const result = await new EmailTransportService(
    new ConfigService(settings),
  ).verify();
  assert.equal(result.authentication, "restricted_key");
  assert.equal(result.senderVerified, null);
});

test("las plantillas delegan al mismo transporte con Message-ID estable y rechazan cabeceras inválidas", async () => {
  const calls: { text: string; messageId?: string }[] = [];
  const config = new ConfigService(settings);
  const email = new EmailService(config, {
    send: async (input: { text: string; messageId?: string }) => {
      calls.push(input);
      return { provider: "resend", accepted: true, messageId: "id" };
    },
  } as never);
  await email.sendEmailDirect({
    to: message.to,
    subject: "Pedido",
    template: EmailTemplate.STORE_MESSAGE,
    data: {
      message: "Verifica tu correo https://example.test/verify?token=one",
    },
    messageId: message.messageId,
  });
  assert.match(calls[0].text, /verify\?token=one/);
  assert.equal(calls[0].messageId, message.messageId);
  await assert.rejects(
    email.sendEmailDirect({
      to: "user@example.test\r\nBcc: other@example.test",
      subject: "Pedido",
      template: EmailTemplate.STORE_MESSAGE,
      data: {},
    }),
  );
  assert.equal(calls.length, 1);
});
