import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import {
  AuthUser,
  CurrentUser,
} from "@/common/decorators/current-user.decorator";
import { Public } from "@/common/decorators/public.decorator";
import { JwtAuthGuard } from "@/common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "@/common/guards/optional-jwt-auth.guard";
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from "./dto/auth.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post("register")
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(body);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("login")
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(body);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user, expiresIn: result.expiresIn };
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("refresh")
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] as string;
    const rawToken = body.refreshToken ?? this.readCookie(req, "refresh_token");

    const result = await this.authService.refresh(rawToken, ip, userAgent);
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    return { expiresIn: result.expiresIn };
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 5 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("forgot-password")
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.sub,
      email: user.email,
      fullName: user.fullName ?? null,
      roles: user.roles,
      companyId: user.companyId ?? null,
      companyStatus: user.companyStatus ?? null,
      planCode: user.planCode ?? null,
      subscriptionStatus: user.subscriptionStatus ?? null,
      trialEndsAt: user.trialEndsAt ?? null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Patch("me")
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() body: UpdateProfileDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.updateProfile(
      user.sub,
      body.fullName,
      user.sid,
      user.companyId ?? null,
    );
    this.setAccessCookie(res, result.accessToken);
    return { user: result.user };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post("change-password")
  async changePassword(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.changePassword(
      user.sub,
      body.oldPassword,
      body.newPassword,
    );
    this.clearAuthCookies(res);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 5 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("reset-password")
  async resetPassword(@Body() body: ResetPasswordDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.resetPassword(body.token, body.password);
    this.clearAuthCookies(res);
    return result;
  }

  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post("logout")
  async logout(
    @CurrentUser() user: AuthUser | null,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(
      this.readCookie(req, "refresh_token"),
      user?.sub,
    );
    this.clearAuthCookies(res);
    return { message: "Logged out successfully" };
  }

  private readCookie(req: Request, name: string): string | undefined {
    const cookies = (req as Request & { cookies?: Record<string, string> })
      .cookies;
    const value = cookies?.[name];
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private setAccessCookie(res: Response, accessToken: string) {
    const accessMaxAge = 15 * 60 * 1000;
    const isProd = process.env.NODE_ENV === "production";
    const sameSite = isProd ? "none" : "lax";

    res.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite,
      maxAge: accessMaxAge,
      path: "/",
    });
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    this.setAccessCookie(res, accessToken);

    const refreshMaxAge = 7 * 24 * 60 * 60 * 1000;
    const isProd = process.env.NODE_ENV === "production";
    const sameSite = isProd ? "none" : "lax";

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite,
      maxAge: refreshMaxAge,
      path: "/",
    });
  }

  private clearAuthCookies(res: Response) {
    const isProd = process.env.NODE_ENV === "production";
    const sameSite = isProd ? "none" : "lax";

    res.cookie("access_token", "", {
      httpOnly: true,
      secure: isProd,
      sameSite,
      maxAge: 0,
      path: "/",
    });

    res.cookie("refresh_token", "", {
      httpOnly: true,
      secure: isProd,
      sameSite,
      maxAge: 0,
      path: "/",
    });
  }
}
