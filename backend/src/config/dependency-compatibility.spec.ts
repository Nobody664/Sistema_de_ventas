import assert from "node:assert/strict";
import { describe, it } from "node:test";
import nodemailer from "nodemailer";
import { validateEnv } from "./env";

describe("Updated dependency compatibility", () => {
  it("preserves Zod environment defaults, coercion and boolean parsing", () => {
    const env = validateEnv({
      DATABASE_URL: "postgresql://test.invalid/database",
      JWT_ACCESS_SECRET: "test-access-secret",
      JWT_REFRESH_SECRET: "test-refresh-secret",
      PORT: "4001",
      SMTP_ENABLED: "false",
      DB_SSL: "true",
    });
    assert.equal(env.PORT, 4001);
    assert.equal(env.SMTP_ENABLED, false);
    assert.equal(env.DB_SSL, true);
    assert.equal(env.NODE_ENV, "development");
    assert.throws(() => validateEnv({ DATABASE_URL: "" }));
  });
  it("builds an SMTP message with stable Message-ID without contacting a real provider", async () => {
    const transport = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });
    try {
      const result = await transport.sendMail({
        from: "sender@example.invalid",
        to: "owner@example.invalid",
        subject: "Prueba",
        text: "Contenido",
        messageId: "<event@huanka-saas.local>",
      });
      const text = result.message.toString();
      assert.match(text, /Message-ID: <event@huanka-saas.local>/i);
      assert.match(text, /Contenido/);
    } finally {
      transport.close();
    }
  });
});
