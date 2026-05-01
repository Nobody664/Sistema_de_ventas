const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    companyId: string | null;
    planCode: string | null;
    subscriptionStatus: string | null;
  };
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
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

export async function getMe(): Promise<AuthResponse['user']> {
  const token = getAccessToken();
  if (!token) throw new AuthApiError('No autenticado', 401);

  const response = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });

  return handleResponse<AuthResponse['user']>(response);
}

export async function refreshToken(): Promise<RefreshResponse> {
  const refreshTokenValue = getRefreshToken();
  if (!refreshTokenValue) throw new AuthApiError('No hay refresh token', 401);

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refreshTokenValue }),
    credentials: 'include',
  });

  return handleResponse<RefreshResponse>(response);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
}

export function getAccessToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('accessToken') ?? undefined;
}

export function getRefreshToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return localStorage.getItem('refreshToken') ?? undefined;
}

export function clearTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}