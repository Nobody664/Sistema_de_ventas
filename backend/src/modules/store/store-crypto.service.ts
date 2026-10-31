import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

export const storeHash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
export const storeToken = (): string => randomBytes(32).toString("hex");

@Injectable()
export class StoreCryptoService {
  constructor(private readonly config: ConfigService) {}
  signingKey(): string {
    return createHmac(
      "sha256",
      this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
    )
      .update("store-session-v1")
      .digest("hex");
  }
  private key(): Buffer {
    return createHmac(
      "sha256",
      this.config.getOrThrow<string>("JWT_REFRESH_SECRET"),
    )
      .update("store-private-data-v1")
      .digest();
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
