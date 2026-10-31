import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { PrismaService } from "@/database/prisma/prisma.service";
import { StoreCryptoService } from "./store-crypto.service";

export interface StoreActor {
  sub: string;
  companyId: string;
  accountId: string;
  customerId: string;
  sid: string;
  roles: ["USUARIO_CLIENTE_FINAL"];
}

@Injectable()
export class StoreStrategy extends PassportStrategy(Strategy, "store-jwt") {
  constructor(
    private readonly prisma: PrismaService,
    crypto: StoreCryptoService,
  ) {
    super({
      jwtFromRequest: (req: Request) =>
        req.cookies?.store_access_token ??
        ExtractJwt.fromAuthHeaderAsBearerToken()(req),
      secretOrKey: crypto.signingKey(),
      audience: "store",
      passReqToCallback: true,
    });
  }
  async validate(
    req: Request,
    payload: {
      sub?: string;
      sid?: string;
      accountId?: string;
      companyId?: string;
      authVersion?: number;
    },
  ): Promise<StoreActor> {
    if (
      !payload.sid ||
      !payload.sub ||
      !payload.accountId ||
      !payload.companyId
    )
      throw new UnauthorizedException();
    const session = await this.prisma.storeSession.findFirst({
      where: {
        id: payload.sid,
        companyId: payload.companyId,
        accountId: payload.accountId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        account: { include: { user: true, customer: true, company: true } },
      },
    });
    const account = session?.account;
    if (
      !session ||
      !account ||
      account.status !== "ACTIVE" ||
      !account.user.isActive ||
      account.customer.deletedAt ||
      account.userId !== payload.sub ||
      session.authVersion !== account.user.authVersion ||
      payload.authVersion !== account.user.authVersion ||
      (req.params.slug && req.params.slug !== account.company.slug)
    )
      throw new UnauthorizedException(
        "La cuenta o la sesión comercial no está activa",
      );
    return {
      sub: account.userId,
      companyId: account.companyId,
      accountId: account.id,
      customerId: account.customerId,
      sid: session.id,
      roles: ["USUARIO_CLIENTE_FINAL"],
    };
  }
}
