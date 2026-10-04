const API_URL = '/api';

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
  user: {
    id: string;
    email: string;
    fullName: string | null;
    roles: string[];
    companyId: string | null;
    companyStatus?: string | null;
    planCode?: string | null;
    subscriptionStatus?: string | null;
    trialEndsAt?: string | null;
  };
  expiresIn?: string;
}

export type AuthUser = AuthResponse['user'];

export interface RefreshResponse {
  expiresIn?: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = 'Error de autenticación';
    let errorCode: string | undefined;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorCode = errorData.code;
    } catch {
      errorMessage = `Error ${response.status}`;
    }

    throw new AuthApiError(errorMessage, response.status, errorCode);
  }

  return response.json() as Promise<T>;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  return handleResponse<AuthResponse>(response);
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });

  return handleResponse<AuthResponse>(response);
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getMe(): Promise<AuthUser> {
  const response = await fetch(`${API_URL}/auth/me`, {
    credentials: 'include',
  });

  return handleResponse<AuthUser>(response);
}

export async function refreshToken(): Promise<RefreshResponse> {
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
    credentials: 'include',
  });

  return handleResponse<RefreshResponse>(response);
}

export function getAccessToken(): undefined {
  return undefined;
}

export function getRefreshToken(): undefined {
  return undefined;
}

export function isAuthenticated(): boolean {
  return false;
}