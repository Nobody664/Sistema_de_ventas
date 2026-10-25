import { parseSessionUser, type SessionUser } from "@/lib/session-contract";
import { ApiError, apiFetch } from "./client";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
}

export interface AuthResponse {
  user: SessionUser;
  expiresIn?: string;
}

export type AuthUser = SessionUser;

export interface RefreshResponse {
  expiresIn?: string;
}

export class AuthApiError extends ApiError {
  constructor(message: string, status: number, code?: string) {
    super(message, status, code);
    this.name = "AuthApiError";
  }
}

function parseAuthResponse(response: {
  user: unknown;
  expiresIn?: string;
}): AuthResponse {
  return {
    user: parseSessionUser(response.user),
    expiresIn: response.expiresIn,
  };
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiFetch<{ user: unknown; expiresIn?: string }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(data),
      skipRefresh: true,
    },
  );

  return parseAuthResponse(response);
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiFetch<{ user: unknown; expiresIn?: string }>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(data),
      skipRefresh: true,
    },
  );

  return parseAuthResponse(response);
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
    skipRefresh: true,
  });
}

export async function getMe(): Promise<AuthUser> {
  const response = await apiFetch<unknown>("/auth/me");
  return parseSessionUser(response);
}

export interface UpdateProfileResponse {
  user: AuthUser;
}

export async function updateProfile(
  fullName: string,
): Promise<UpdateProfileResponse> {
  const response = await apiFetch<{ user: unknown }>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ fullName }),
  });

  return { user: parseSessionUser(response.user) };
}

export async function refreshToken(): Promise<RefreshResponse> {
  return apiFetch<RefreshResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({}),
    skipRefresh: true,
  });
}

export function getAccessToken(): undefined {
  return undefined;
}
