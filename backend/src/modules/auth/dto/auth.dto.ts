import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(2)
  companyName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}

export class AuthSessionDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    companyId?: string | null;
  };
  @IsOptional()
  expiresIn?: string;
}

