import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { randomBytes, createHash } from "crypto";
import { Prisma, RefreshTokenType } from "@prisma/client";
import { serializableTransaction } from "@/common/helpers/serializable-transaction.helper";
import { PrismaService } from "@/database/prisma/prisma.service";
import { UsersService } from "@/modules/users/users.service";
import { EmailService } from "@/modules/email/email.service";
import { LoginDto, RegisterDto } from "./dto/auth.dto";

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
  sid?: string;
  authVersion?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private generateOpaqueToken(): string {
    return randomBytes(64).toString("hex");
  }

  private getRefreshTtlMs(): number {
    const configured = this.configService.get<string>("JWT_REFRESH_TTL");
    if (!configured) {
      return DEFAULT_REFRESH_TTL_MS;
    }

    const match = /^(\d+)\s*([smhd])?$/.exec(configured.trim());
    if (!match) {
      this.logger.warn(`JWT_REFRESH_TTL invalido: ${configured}. Usando 7d.`);
      return DEFAULT_REFRESH_TTL_MS;
    }

    const value = Number(match[1]);
    const unit = match[2] ?? "s";
    const multiplier =
      unit === "s"
        ? 1000
        : unit === "m"
          ? 60_000
          : unit === "h"
            ? 3_600_000
            : 86_400_000;

    return value * multiplier;
  }

  async register(input: RegisterDto) {
    try {
      const existingUser = await this.usersService.findByEmail(input.email);
      if (existingUser) {
        throw new ConflictException(
          "El correo electrónico ya está registrado.",
        );
      }

      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      const company = await this.prisma.company.create({
        data: {
          name: input.companyName,
          slug: `${input.companyName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-")}-${Date.now().toString().slice(-6)}`,
          phone: input.phone || null,
          status: "TRIAL",
          trialEndsAt,
        },
      });

      const planCode = input.planCode || "FREE";
      const plan = await this.prisma.plan.findUnique({
        where: { code: planCode },
      });
      if (!plan) {
        throw new BadRequestException(
          `Plan con código ${planCode} no encontrado.`,
        );
      }

      const subscription = await this.prisma.subscription.create({
        data: {
          companyId: company.id,
          planId: plan.id,
          status: planCode === "FREE" ? "TRIALING" : "TRIALING",
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
        authVersion: user.authVersion,
        email: user.email,
        companyId: company.id,
        roles: ["COMPANY_ADMIN"],
        fullName: user.fullName,
        planCode,
        subscriptionStatus: subscription.status,
      });
    } catch (error) {
      this.logger.error("Error during registration", error);
      throw error;
    }
  }

  async login(input: LoginDto) {
    const user = await this.usersService.findByEmail(input.email);
    if (!user?.isActive) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const validPassword = await argon2.verify(
      user.passwordHash,
      input.password,
    );
    if (!validPassword) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const membership = await this.prisma.membership.findFirst({
      where: { userId: user.id, isActive: true },
      include: { company: true },
      orderBy: { createdAt: "asc" },
    });

    if (
      (!membership && user.globalRole === "USER") ||
      (membership &&
        user.employee?.companyId === membership.companyId &&
        (!user.employee.isActive || user.employee.deletedAt))
    )
      throw new UnauthorizedException(
        "El usuario no tiene una membresía activa",
      );

    if (membership?.company) {
      if (membership.company.status === "SUSPENDED") {
        throw new UnauthorizedException(
          "Tu cuenta ha sido suspendida. Contacta al administrador.",
        );
      }
    }

    let subscriptionStatus: string | undefined;
    let planCode: string | undefined;

    if (membership?.companyId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { companyId: membership.companyId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
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
      authVersion: user.authVersion,
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
      throw new UnauthorizedException("Refresh token is required.");
    }

    const tokenHash = this.hashToken(rawToken);
    const outcome = await serializableTransaction(this.prisma, async (tx) => {
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!stored || stored.type !== RefreshTokenType.SESSION) return null;
      if (stored.revokedAt || stored.expiresAt <= new Date()) {
        await tx.refreshToken.updateMany({ where: { familyId: stored.familyId, type: "SESSION", revokedAt: null }, data: { revokedAt: new Date() } });
        return null;
      }
      const user = await tx.user.findUnique({ where: { id: stored.userId }, include: { employee: { select: { companyId: true, isActive: true, deletedAt: true } } } });
      const membership = stored.companyId ? await tx.membership.findFirst({ where: { userId: stored.userId, companyId: stored.companyId, isActive: true } }) : null;
      if (!user?.isActive || (user.authVersion ?? 0) !== (stored.authVersion ?? 0) ||
          (stored.companyId && !membership) || (!membership && user.globalRole === "USER") ||
          (membership && user.employee?.companyId === membership.companyId && (!user.employee.isActive || user.employee.deletedAt))) {
        await tx.refreshToken.updateMany({ where: { familyId: stored.familyId, type: "SESSION", revokedAt: null }, data: { revokedAt: new Date() } });
        return null;
      }
      const subscription = membership ? await tx.subscription.findFirst({ where: { companyId: membership.companyId }, include: { plan: true } }) : null;
      const newRefreshToken = this.generateOpaqueToken();
      const newRefreshHash = this.hashToken(newRefreshToken);
      const claimed = await tx.refreshToken.updateMany({
        where: {
          id: stored.id,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          authVersion: stored.authVersion ?? 0,
        },
        data: { revokedAt: new Date(), replacedBy: newRefreshHash },
      });
      if (claimed.count !== 1)
        throw new UnauthorizedException("El refresh token ya fue utilizado");
      const claims: SessionClaims = { sub: user.id, email: user.email, fullName: user.fullName, companyId: stored.companyId,
        sid: stored.familyId, authVersion: user.authVersion ?? 0,
        roles: membership ? [user.globalRole, membership.role] : [user.globalRole],
        planCode: subscription?.plan.code, subscriptionStatus: subscription?.status };
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          companyId: claims.companyId ?? null,
          tokenHash: newRefreshHash,
          familyId: stored.familyId,
          authVersion: claims.authVersion,
          type: RefreshTokenType.SESSION,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
        },
      });
      const { accessToken } = await this.signAccessToken(claims, tx);
      return { accessToken, refreshToken: newRefreshToken };
    });
    if (!outcome) throw new UnauthorizedException("Invalid or revoked refresh token.");
    return {
      ...outcome,
      expiresIn: this.configService.get<string>("JWT_ACCESS_TTL") ?? "15m",
    };
  }

  async logout(rawToken?: string, userId?: string) {
    await serializableTransaction(this.prisma, async (tx) => {
    if (rawToken) {
      const tokenHash = this.hashToken(rawToken);
      const stored = await tx.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (stored && stored.type === RefreshTokenType.SESSION) {
        await tx.refreshToken.updateMany({
          where: { familyId: stored.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } else if (userId) {
      await tx.user.updateMany({ where: { id: userId }, data: { authVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({
        where: { userId, type: RefreshTokenType.SESSION, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    });
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user?.isActive) {
      return {
        status: "queued",
        message:
          "If an account exists with that email, a password reset link will be sent.",
      };
    }

    const token = this.generateOpaqueToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    const issued = await serializableTransaction(this.prisma, async (tx) => {
      const current = await tx.user.findFirst({ where: { id: user.id, isActive: true, authVersion: user.authVersion ?? 0 }, select: { id: true } });
      if (!current) return false;
      await tx.refreshToken.updateMany({ where: { userId: user.id, type: "RESET", revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId: `reset:${randomBytes(8).toString("hex")}`,
        type: RefreshTokenType.RESET,
        authVersion: user.authVersion ?? 0,
        expiresAt,
        ipAddress: null,
        userAgent: null,
      },
    });
      return true;
    });
    if (!issued) return { status: "queued", message: "If an account exists with that email, a password reset link will be sent." };

    const frontendUrl = (
      this.configService.get<string>("FRONTEND_URL") ?? "http://localhost:3000"
    ).replace(/\/+$/, "");
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    try {
      await this.emailService.sendPasswordReset(user.email, resetUrl);
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo de recuperación a ${user.email}: ${(error as Error).message}`,
      );
    }

    return {
      status: "queued",
      message:
        "If an account exists with that email, a password reset link will be sent.",
      ...(process.env.NODE_ENV === "development" ? { devToken: token } : {}),
    };
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = this.hashToken(token);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (
      !stored ||
      stored.type !== RefreshTokenType.RESET ||
      stored.revokedAt ||
      stored.expiresAt <= new Date()
    ) {
      throw new BadRequestException("Invalid or expired password reset token.");
    }

    const passwordHash = await argon2.hash(password);
    await serializableTransaction(this.prisma, async (tx) => {
      const consumed = await tx.refreshToken.updateMany({ where: { id: stored.id, userId: stored.userId, type: "RESET", revokedAt: null, expiresAt: { gt: new Date() }, authVersion: stored.authVersion ?? 0 }, data: { revokedAt: new Date() } });
      if (consumed.count !== 1) throw new BadRequestException("Invalid or expired password reset token.");
      const updated = await tx.user.updateMany({
        where: { id: stored.userId, isActive: true, authVersion: stored.authVersion ?? 0 },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new BadRequestException("Invalid or expired password reset token.");
      await tx.refreshToken.updateMany({
        where: {
          userId: stored.userId,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    });

    return { message: "Password updated successfully." };
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ) {
    const user = await this.usersService.findById(userId);
    if (!user?.isActive) {
      throw new UnauthorizedException("User not found.");
    }

    const valid = await argon2.verify(user.passwordHash, oldPassword);
    if (!valid) {
      throw new UnauthorizedException("Current password is incorrect.");
    }

    const passwordHash = await argon2.hash(newPassword);
    await serializableTransaction(this.prisma, async (tx) => {
      const updated = await tx.user.updateMany({ where: { id: userId, isActive: true, passwordHash: user.passwordHash, authVersion: user.authVersion ?? 0 }, data: { passwordHash, authVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new UnauthorizedException("La contraseña o la sesión cambiaron. Vuelve a autenticarte.");
      await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    });

    return { message: "Password changed successfully." };
  }

  async updateProfile(
    userId: string,
    fullName: string,
    sid: string | undefined,
    companyId: string | null,
  ) {
    if (!sid) throw new UnauthorizedException("La sesión debe renovarse");
    const user = await this.usersService.findById(userId);
    if (!user?.isActive) {
      throw new UnauthorizedException("User not found.");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { fullName },
    });

    const membership = await this.prisma.membership.findFirst({
      where: { userId, isActive: true, companyId: companyId ?? "" },
      orderBy: { createdAt: "asc" },
    });

    let planCode: string | undefined;
    let subscriptionStatus: string | undefined;

    if (membership?.companyId) {
      const subscription = await this.prisma.subscription.findFirst({
        where: { companyId: membership.companyId },
        include: { plan: true },
        orderBy: { createdAt: "desc" },
      });

      if (subscription) {
        subscriptionStatus = subscription.status;
        planCode = subscription.plan.code;
      }
    }

    const claims: SessionClaims = {
      sub: user.id,
      sid,
      authVersion: user.authVersion ?? 0,
      email: user.email,
      fullName,
      companyId: membership?.companyId ?? null,
      roles: membership
        ? [user.globalRole, membership.role]
        : [user.globalRole],
      planCode,
      subscriptionStatus,
    };

    const { accessToken, companyStatus, trialEndsAt } =
      await this.signAccessToken(claims);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName,
        companyId: claims.companyId,
        roles: claims.roles,
        companyStatus,
        planCode,
        subscriptionStatus,
        trialEndsAt,
      },
    };
  }

  private async signAccessToken(claims: SessionClaims, client: Prisma.TransactionClient | PrismaService = this.prisma) {
    let companyStatus: string | undefined;
    let trialEndsAt: string | null | undefined;

    if (claims.companyId) {
      const company = await client.company.findUnique({
        where: { id: claims.companyId },
        select: { status: true, trialEndsAt: true },
      });
      companyStatus = company?.status;
      trialEndsAt = company?.trialEndsAt?.toISOString() ?? null;
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: claims.sub,
        sid: claims.sid,
        authVersion: claims.authVersion ?? 0,
        email: claims.email,
        fullName: claims.fullName ?? null,
        companyId: claims.companyId,
        roles: claims.roles,
        companyStatus,
        trialEndsAt,
        planCode: claims.planCode ?? null,
        subscriptionStatus: claims.subscriptionStatus ?? null,
      },
      {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: this.configService.getOrThrow<string>(
          "JWT_ACCESS_TTL",
        ) as import("ms").StringValue,
      },
    );

    return { accessToken, companyStatus, trialEndsAt };
  }

  private async createSession(input: SessionClaims) {
    const familyId = randomBytes(16).toString("hex");

    const refreshTokenPlain = this.generateOpaqueToken();
    const refreshTokenHash = this.hashToken(refreshTokenPlain);

    const { accessToken, companyStatus, trialEndsAt } = await serializableTransaction(this.prisma, async (tx) => {
      const current = await tx.user.findFirst({ where: { id: input.sub, isActive: true, authVersion: input.authVersion ?? 0 }, select: { id: true } });
      if (!current) throw new UnauthorizedException("La sesión cambió durante el inicio de sesión");
      await tx.refreshToken.create({
      data: {
        userId: input.sub,
        companyId: input.companyId ?? null,
        tokenHash: refreshTokenHash,
        familyId,
        authVersion: input.authVersion ?? 0,
        type: RefreshTokenType.SESSION,
        expiresAt: new Date(Date.now() + this.getRefreshTtlMs()),
      },
    });
      return this.signAccessToken({ ...input, sid: familyId }, tx);
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
      expiresIn: this.configService.get<string>("JWT_ACCESS_TTL") ?? "15m",
    };
  }
}
