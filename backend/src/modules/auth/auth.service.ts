import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { RefreshTokenType, type Prisma } from '@prisma/client';
import { PrismaService } from '@/database/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const DEFAULT_REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;

interface SessionClaims {
  sub: string;
  email: string;
  companyId?: string | null;
  roles: string[];
  planCode?: string | null;
  subscriptionStatus?: string;
  fullName?: string | null;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateOpaqueToken(): string {
    return randomBytes(64).toString('hex');
  }

  private getRefreshTtlMs(): number {
    const configured = this.configService.get<string>('JWT_REFRESH_TTL');
    if (!configured) {
      return DEFAULT_REFRESH_TTL_MS;
    }

    const match = /^(\d+)\s*([smhd])?$/.exec(configured.trim());
    if (!match) {
      this.logger.warn(`JWT_REFRESH_TTL invalido: ${configured}. Usando 7d.`);
      return DEFAULT_REFRESH_TTL_MS;
    }

    const value = Number(match[1]);
    const unit = match[2] ?? 's';
    const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;

    return value * multiplier;
  }

  async register(input: RegisterDto) {
    try {
      const existingUser = await this.usersService.findByEmail(input.email);
      if (existingUser) {
        throw new ConflictException('El correo electrónico ya está registrado.');
      }

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      const company = await this.prisma.company.create({
        data: {
          name: input.companyName,
          slug: `${input.companyName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')}-${Date.now().toString().slice(-6)}`,
          phone: input.phone || null,
          status: 'TRIAL',
          trialEndsAt,
        },
      });

      const planCode = input.planCode || 'FREE';
      const plan = await this.prisma.plan.findUnique({
        where: { code: planCode },
      });
      if (!plan) {
        throw new BadRequestException(`Plan con código ${planCode} no encontrado.`);
      }

      const subscription = await this.prisma.subscription.create({
        data: {
          companyId: company.id,
          planId: plan.id,
          status: planCode === 'FREE' ? 'TRIALING' : 'TRIALING',
          billingCycle: plan.billingCycle,
          startDate: new Date(),
          endDate: trialEndsAt,
        },
      });

      const passwordHash = await argon2.hash(input.password);
      const user = await this.usersService.createOwner({
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        companyId: company.id,
      });

      return this.createSession({
        sub: user.id,
        email: user.email,
        companyId: company.id,
        roles: ['COMPANY_ADMIN'],
        fullName: user.fullName,
        planCode,
        subscriptionStatus: subscription.status,
      });
    } catch (error) {
      this.logger.error('Error during registration', error);
      throw error;
    }
  }

  async login(input: LoginDto) {
    const user = await this.usersService.findByEmail(input.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const validPassword = await argon2.verify(user.passwordHash, input.password);
    if (!validPassword) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, isActive: true },
      include: { company: true },
      orderBy: { createdAt: 'asc' },
    });

    if (membership?.company) {
      if (membership.company.status === 'SUSPENDED') {
        throw new UnauthorizedException('Tu cuenta ha sido suspendida. Contacta al administrador.');
      }
    }

    let subscriptionStatus: string | undefined;
    let planCode: string | undefined;

    if (membership?.companyId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { companyId: membership.companyId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
      if (subscription) {
        subscriptionStatus = subscription.status;
        planCode = subscription.plan.code;
      }
    }

    const roles = membership
      ? [user.globalRole, membership.role]
      : [user.globalRole];

    return this.createSession({
      sub: user.id,
      email: user.email,
      companyId: membership?.companyId ?? null,
      roles,
      fullName: user.fullName,
      planCode,
      subscriptionStatus,
    });
  }

  async refresh(rawToken?: string, ipAddress?: string, userAgent?: string) {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token is required.');
    }

    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.type !== RefreshTokenType.SESSION) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      this.logger.warn(`Reuse of revoked refresh token detected for user ${stored.userId}`);
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.usersService.findById(stored.userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const membership = stored.companyId
      ? await this.prisma.membership.findFirst({
          where: { userId: user.id, companyId: stored.companyId, isActive: true },
          orderBy: { createdAt: 'asc' },
        })
      : await this.prisma.membership.findFirst({
          where: { userId: user.id, isActive: true },
          orderBy: { createdAt: 'asc' },
        });

    let planCode: string | undefined;
    let subscriptionStatus: string | undefined;

    if (membership?.companyId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { companyId: membership.companyId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });

      if (subscription) {
        subscriptionStatus = subscription.status;
        planCode = subscription.plan.code;
      }
    }

    const claims: SessionClaims = {
      sub: user.id,
      email: user.email,
      companyId: membership?.companyId ?? stored.companyId ?? null,
      roles: membership ? [user.globalRole, membership.role] : [user.globalRole],
      planCode,
      subscriptionStatus,
    };

    const { accessToken } = await this.signAccessToken(claims);
    const newRefreshToken = this.generateOpaqueToken();
    const newRefreshHash = this.hashToken(newRefreshToken);

    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          companyId: claims.companyId ?? null,
          tokenHash: newRefreshHash,
          familyId: stored.familyId,
          type: RefreshTokenType.SESSION,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
        },
      });

      await tx.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date(), replacedBy: newRefreshHash },
      });
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: this.configService.get<string>('JWT_ACCESS_TTL') ?? '15m',
    };
  }

  async logout(rawToken?: string, userId?: string) {
    if (rawToken) {
      const tokenHash = this.hashToken(rawToken);
      const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

      if (stored && stored.type === RefreshTokenType.SESSION) {
        await this.prisma.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } else if (userId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId, type: RefreshTokenType.SESSION, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return {
        status: 'queued',
        message: 'If an account exists with that email, a password reset link will be sent.',
      };
    }

    const token = this.generateOpaqueToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId: `reset:${randomBytes(8).toString('hex')}`,
        type: RefreshTokenType.RESET,
        expiresAt,
        ipAddress: null,
        userAgent: null,
      },
    });

    return {
      status: 'queued',
      message: 'If an account exists with that email, a password reset link will be sent.',
      ...(process.env.NODE_ENV === 'development' ? { devToken: token } : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.type !== RefreshTokenType.RESET || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token.');
    }

    const passwordHash = await argon2.hash(password);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: stored.userId }, data: { passwordHash } });
      await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
      await tx.refreshToken.updateMany({
        where: { userId: stored.userId, type: RefreshTokenType.SESSION, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: 'Password updated successfully.' };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    const valid = await argon2.verify(user.passwordHash, oldPassword);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.refreshToken.updateMany({
      where: { userId, type: RefreshTokenType.SESSION, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password changed successfully.' };
  }

  private async signAccessToken(claims: SessionClaims) {
    let companyStatus: string | undefined;
    let trialEndsAt: string | null | undefined;

    if (claims.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: claims.companyId },
        select: { status: true, trialEndsAt: true },
      });
      companyStatus = company?.status;
      trialEndsAt = company?.trialEndsAt?.toISOString() ?? null;
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: claims.sub,
        email: claims.email,
        companyId: claims.companyId,
        roles: claims.roles,
        companyStatus,
        trialEndsAt,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_TTL') as StringValue,
      },
    );

    return { accessToken, companyStatus, trialEndsAt };
  }

  private async createSession(input: SessionClaims) {
    const { accessToken, companyStatus, trialEndsAt } = await this.signAccessToken(input);

    const refreshTokenPlain = this.generateOpaqueToken();
    const refreshTokenHash = this.hashToken(refreshTokenPlain);

    await this.prisma.refreshToken.create({
      data: {
        userId: input.sub,
        companyId: input.companyId ?? null,
        tokenHash: refreshTokenHash,
        familyId: randomBytes(16).toString('hex'),
        type: RefreshTokenType.SESSION,
        expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
      },
    });

    return {
      accessToken,
      refreshToken: refreshTokenPlain,
      user: {
        id: input.sub,
        email: input.email,
        fullName: input.fullName ?? null,
        companyId: input.companyId,
        roles: input.roles,
        companyStatus,
        planCode: input.planCode,
        subscriptionStatus: input.subscriptionStatus,
        trialEndsAt,
      },
      expiresIn: this.configService.get<string>('JWT_ACCESS_TTL') ?? '15m',
    };
  }
}
