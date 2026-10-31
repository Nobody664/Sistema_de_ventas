import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";

export function publicWebhookIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) ||
    (a === 203 && b === 0)
  );
}

@Injectable()
export class WebhookTransportService {
  constructor(private readonly config: ConfigService) {}

  allowedHosts(): string[] {
    return (this.config.get<string>("WEBHOOK_ALLOWED_HOSTS") ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean);
  }

  validate(value: string): URL {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException("URL de webhook inválida");
    }
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.hash ||
      (url.port && url.port !== "443") ||
      isIP(url.hostname) ||
      !this.allowedHosts().includes(url.hostname.toLowerCase())
    )
      throw new BadRequestException(
        "El destino debe ser HTTPS y pertenecer a los hosts de integración habilitados por la plataforma",
      );
    return url;
  }

  async send(
    value: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<number> {
    const url = this.validate(value);
    const addresses = await Promise.race([
      lookup(url.hostname, { all: true, family: 4 }),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error("DNS_TIMEOUT")), 5000);
        timer.unref();
      }),
    ]);
    if (
      !addresses.length ||
      addresses.some((entry) => !publicWebhookIPv4(entry.address))
    )
      throw new Error("NON_PUBLIC_DESTINATION");
    const target = addresses[0];
    return new Promise<number>((resolve, reject) => {
      const call = request(
        url,
        {
          method: "POST",
          family: 4,
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(body)),
            ...headers,
          },
          lookup: (_hostname, _options, callback) =>
            callback(null, target.address, 4),
        },
        (response) => {
          const status = response.statusCode ?? 0;
          response.destroy();
          resolve(status);
        },
      );
      const timer = setTimeout(
        () => call.destroy(new Error("WEBHOOK_TIMEOUT")),
        10000,
      );
      call.once("close", () => clearTimeout(timer));
      call.once("error", reject);
      call.end(body);
    });
  }
}
