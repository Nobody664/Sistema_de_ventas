import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '@/database/prisma/prisma.service';
import { CacheService } from '@/cache/cache.service';

type JwtPayload = {
  sub: string;
  email: string;
  fullName: string;
  companyId?: string | null;
  roles: string[];
  companyStatus?: string;
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
    private readonly cache: CacheService,
  ) {
    super({
      jwtFromRequest: (req: Request) => {
        const fromCookie = extractJwtFromCookie(req);
        if (fromCookie) return fromCookie;

        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    if (payload.companyId) {
      const cacheKey = `company:status:${payload.companyId}`;
      let companyStatus = await this.cache.get<string>(cacheKey);

      if (!companyStatus) {
        const company = await this.prisma.company.findUnique({
          where: { id: payload.companyId },
          select: { status: true },
        });
        companyStatus = company?.status ?? null;
        if (companyStatus) {
          await this.cache.set(cacheKey, companyStatus, 30);
        }
      }

      return {
        ...payload,
        companyStatus,
      };
    }

    return payload;
  }
}

