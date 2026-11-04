import { Injectable } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { GoogleTokenVerifier } from "./google-token.verifier";

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly verifier: GoogleTokenVerifier,
    private readonly authService: AuthService,
  ) {}

  async login(credential: string) {
    const identity = await this.verifier.verify(credential);
    return this.authService.loginWithVerifiedEmail(identity.email);
  }
}
