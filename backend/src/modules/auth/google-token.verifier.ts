import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client, type TokenPayload } from "google-auth-library";

export interface GoogleIdentity {
  email: string;
}

@Injectable()
export class GoogleTokenVerifier {
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  async verify(credential: string): Promise<GoogleIdentity> {
    const clientId = this.configService
      .get<string>("GOOGLE_CLIENT_ID")
      ?.trim();
    if (!clientId) {
      throw new ServiceUnavailableException(
        "El inicio de sesión con Google no está configurado",
      );
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        "No se pudo verificar la cuenta de Google",
      );
    }

    if (!payload?.email || payload.email_verified !== true) {
      throw new UnauthorizedException(
        "La cuenta de Google no tiene un correo verificado",
      );
    }

    return { email: payload.email.trim().toLowerCase() };
  }
}
