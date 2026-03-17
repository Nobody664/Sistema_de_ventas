import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '@/database/prisma/prisma.service';

type JwtPayload = {
  sub: string;
  email: string;
  companyId?: string | null;
  roles: string[];
  companyStatus?: string;
};

const extractJwtFromQuery = (req: Request): string | null => {
  if (req.query?.token && typeof req.query.token === 'string') {
    return req.query.token;
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
        const fromQuery = extractJwtFromQuery(req);
        if (fromQuery) {
          return fromQuery;
        }
        return ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      },
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    if (payload.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: payload.companyId },
        select: { status: true },
      });
      
      return {
        ...payload,
        companyStatus: company?.status,
      };
    }
    
    return payload;
  }
}

