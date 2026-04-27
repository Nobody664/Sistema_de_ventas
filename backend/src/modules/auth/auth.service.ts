import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '@/database/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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

    return this.createSession({
      sub: user.id,
      email: user.email,
      companyId: membership?.companyId ?? null,
      roles: membership ? [membership.role] : [user.globalRole],
      fullName: user.fullName,
      planCode,
      subscriptionStatus,
    });
  }

  async refresh(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
        companyId?: string | null;
        roles: string[];
      }>(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }

      return this.createSession({
        sub: user.id,
        email: user.email,
        companyId: payload.companyId ?? null,
        roles: payload.roles,
        fullName: user.fullName,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }
  }

  async forgotPassword(email: string) {
    return {
      email,
      status: 'queued',
      message: 'Password reset workflow should enqueue an email job through BullMQ.',
    };
  }

  private async createSession(input: {
    sub: string;
    email: string;
    fullName: string;
    companyId?: string | null;
    roles: string[];
    planCode?: string | null;
    subscriptionStatus?: string;
  }) {
    const accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL') as never;
    const refreshTtl = this.configService.getOrThrow<string>('JWT_REFRESH_TTL') as never;

    let companyStatus: string | undefined;
    if (input.companyId) {
      const company = await this.prisma.company.findUnique({
        where: { id: input.companyId },
        select: { status: true },
      });
      companyStatus = company?.status;
    }

    const accessToken = await this.jwtService.signAsync(
      {
        sub: input.sub,
        email: input.email,
        companyId: input.companyId,
        roles: input.roles,
        companyStatus,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: accessTtl,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: input.sub,
        email: input.email,
        companyId: input.companyId,
        roles: input.roles,
        companyStatus,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTtl,
      },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: input.sub,
        email: input.email,
        fullName: input.fullName,
        companyId: input.companyId,
        roles: input.roles,
        planCode: input.planCode,
        subscriptionStatus: input.subscriptionStatus,
      },
      expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_TTL'),
    };
  }
}
