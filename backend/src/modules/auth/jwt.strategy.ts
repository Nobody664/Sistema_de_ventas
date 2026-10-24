import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { Request } from "express";
import { PrismaService } from "@/database/prisma/prisma.service";

type JwtPayload = {
  sub: string;
  email: string;
  fullName: string;
  companyId?: string | null;
  roles: string[];
  companyStatus?: string;
  sid?: string;
  authVersion?: number;
};

const extractJwtFromCookie = (req: Request): string | null => {
  if (req.cookies?.access_token) {
    return req.cookies.access_token;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        const fromCookie = extractJwtFromCookie(req);
        if (fromCookie) return fromCookie;

        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    if (
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string" ||
      !payload.sid ||
      payload.sid.length > 128
    )
      throw new UnauthorizedException("La sesión debe renovarse");
    const version = payload.authVersion ?? 0;
    if (!Number.isSafeInteger(version) || version < 0) throw new UnauthorizedException("Versión de sesión inválida");
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        fullName: true,
        globalRole: true,
        isActive: true,
        authVersion: true,
        employee: {
          select: { isActive: true, deletedAt: true, companyId: true },
        },
        refreshTokens: {
          where: {
            familyId: payload.sid,
            authVersion: version,
            companyId: payload.companyId ?? null,
            type: "SESSION",
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
          take: 1,
        },
        memberships: {
          where: { companyId: payload.companyId ?? "", isActive: true },
          take: 1,
          select: {
            role: true,
            company: {
              select: {
                id: true,
                status: true,
                trialEndsAt: true,
                subscriptions: {
                  take: 1,
                  select: { status: true, plan: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!user?.isActive || (user.authVersion ?? 0) !== version || user.refreshTokens.length === 0)
      throw new UnauthorizedException("Sesión revocada o usuario inactivo");
    const membership = user.memberships[0];
    if (
      payload.companyId &&
      (!membership ||
        (user.employee?.companyId === payload.companyId &&
          (!user.employee.isActive || user.employee.deletedAt)))
    )
      throw new UnauthorizedException("La membresía ya no está activa");
    if (!payload.companyId && user.globalRole === "USER")
      throw new UnauthorizedException(
        "El usuario no tiene una membresía activa",
      );
    const company = membership?.company;
    const subscription = company?.subscriptions[0];
    return {
      sub: user.id,
      id: user.id,
      sid: payload.sid,
      email: user.email,
      fullName: user.fullName,
      roles: membership
        ? [user.globalRole, membership.role]
        : [user.globalRole],
      companyId: company?.id ?? null,
      companyStatus: company?.status ?? null,
      trialEndsAt: company?.trialEndsAt?.toISOString() ?? null,
      planCode: subscription?.plan.code ?? null,
      subscriptionStatus: subscription?.status ?? null,
    };
  }
}
