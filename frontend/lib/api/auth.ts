import { parseSessionUser, type SessionUser } from "@/lib/session-contract";
import { ApiError, apiFetch } from "./client";
import {
  waitForAuthBackend,
  type AuthRequestOptions,
} from "@/lib/auth-readiness";

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

export async function login(
  data: LoginRequest,
  options: AuthRequestOptions = {},
): Promise<AuthResponse> {
  options.onStage?.("connecting");
  await waitForAuthBackend({ signal: options.signal });
  options.onStage?.("authenticating");
  const response = await apiFetch<{ user: unknown; expiresIn?: string }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(data),
      skipRefresh: true,
      timeoutMs: 30000,
      signal: options.signal,
    },
  );

  return parseAuthResponse(response);
}

export async function loginWithGoogle(
  credential: string,
  options: AuthRequestOptions = {},
): Promise<AuthResponse> {
  options.onStage?.("connecting");
  await waitForAuthBackend({ signal: options.signal });
  options.onStage?.("authenticating");
  const response = await apiFetch<{ user: unknown; expiresIn?: string }>(
    "/auth/google",
    {
      method: "POST",
      body: JSON.stringify({ credential }),
      skipRefresh: true,
      timeoutMs: 30000,
      signal: options.signal,
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

export async function updateAvatar(
  avatarUrl: string | null,
): Promise<{ avatarUrl: string | null }> {
  return apiFetch<{ avatarUrl: string | null }>("/auth/me/avatar", {
    method: "PATCH",
    body: JSON.stringify({ avatarUrl }),
  });
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
