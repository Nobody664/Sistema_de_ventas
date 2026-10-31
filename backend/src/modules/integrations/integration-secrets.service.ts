import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

@Injectable()
export class IntegrationSecretsService {
  constructor(private readonly config: ConfigService) {}

  available(): boolean {
    return (
      Buffer.from(
        this.config.get<string>("INTEGRATION_ENCRYPTION_KEY") ?? "",
        "base64",
      ).length === 32
    );
  }

  private key(): Buffer {
    if (!this.available())
      throw new ServiceUnavailableException(
        "El canal de integraciones necesita una clave de cifrado de servidor",
      );
    return Buffer.from(
      this.config.get<string>("INTEGRATION_ENCRYPTION_KEY")!,
      "base64",
    );
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    return Buffer.concat([
      iv,
      cipher.update(value, "utf8"),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString("base64");
  }

  decrypt(value: string): string {
    const bytes = Buffer.from(value, "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key(),
      bytes.subarray(0, 12),
    );
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([
      decipher.update(bytes.subarray(12, -16)),
      decipher.final(),
    ]).toString("utf8");
  }
}
