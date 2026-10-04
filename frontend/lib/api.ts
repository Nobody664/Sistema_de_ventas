export { getAccessToken, getRefreshToken, isAuthenticated } from './api/auth';
export { login, register, logout, getMe, refreshToken } from './api/auth';
export type { LoginRequest, RegisterRequest, AuthResponse, AuthUser, RefreshResponse } from './api/auth';

const API_URL = '/api';

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      credentials: 'include',
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

async function parseError(response: Response): Promise<Error> {
  const errorText = await response.text();

  try {
    const error = JSON.parse(errorText);
    if (error.error !== 'LIMIT_EXCEEDED') {
      console.error('API Error:', response.status, errorText);
    }
    return new Error(error.message || `Error ${response.status}`, { cause: error });
  } catch (e) {
    if (e instanceof SyntaxError) {
      return new Error(errorText || `Error ${response.status}`);
    }
    return e as Error;
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string; skipRefresh?: boolean },
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const buildInit = (): RequestInit => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const initHeaders = init?.headers as Record<string, string> | undefined;
    if (initHeaders?.['Authorization']) {
      headers['Authorization'] = initHeaders['Authorization'];
    } else if (init?.token) {
      headers['Authorization'] = `Bearer ${init.token}`;
    }

    return { ...init, headers, credentials: 'include' };
  };

  const response = await fetch(`${API_URL}${normalizedPath}`, buildInit());

  if (response.status === 401 && !init?.skipRefresh && !normalizedPath.startsWith('/auth/')) {
    const refreshed = await refreshAccessToken();

    if (refreshed) {
      const retryResponse = await fetch(`${API_URL}${normalizedPath}`, buildInit());

      if (!retryResponse.ok) {
        throw await parseError(retryResponse);
      }

      return retryResponse.json() as Promise<T>;
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.json() as Promise<T>;
}