import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { PrismaService } from '@/database/prisma/prisma.service';
import { UsersService } from '@/modules/users/users.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(input: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(input.email);
    if (existingUser) {
      throw new ConflictException('Email already exists.');
    }

    const company = await this.prisma.company.create({
      data: {
        name: input.companyName,
        slug: `${input.companyName
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-')}-${Date.now().toString().slice(-6)}`,
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
    });
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

    const membership = await this.prisma.companyMembership.findFirst({
      where: { userId: user.id, isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    return this.createSession({
      sub: user.id,
      email: user.email,
      companyId: membership?.companyId ?? null,
      roles: membership ? [membership.role] : [user.globalRole],
      fullName: user.fullName,
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
  }) {
    const accessTtl = this.configService.getOrThrow<string>('JWT_ACCESS_TTL') as never;
    const refreshTtl = this.configService.getOrThrow<string>('JWT_REFRESH_TTL') as never;

    const accessToken = await this.jwtService.signAsync(
      {
        sub: input.sub,
        email: input.email,
        companyId: input.companyId,
        roles: input.roles,
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
      },
      expiresIn: this.configService.getOrThrow<string>('JWT_ACCESS_TTL'),
    };
  }
}
