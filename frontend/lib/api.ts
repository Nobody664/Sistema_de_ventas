export { getAccessToken, getRefreshToken, setTokens, clearTokens, isAuthenticated } from './api/auth';
export { login, register, logout, getMe, refreshToken } from './api/auth';
export type { LoginRequest, RegisterRequest, AuthResponse, RefreshResponse } from './api/auth';

const API_URL = '/api';

export async function apiFetch<T>(path: string, init?: RequestInit & { token?: string }): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const initHeaders = init?.headers as Record<string, string> | undefined;
  if (initHeaders?.['Authorization']) {
    headers['Authorization'] = initHeaders['Authorization'];
  } else if (init?.token) {
    headers['Authorization'] = `Bearer ${init.token}`;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const response = await fetch(`${API_URL}${normalizedPath}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();

    try {
      const error = JSON.parse(errorText);
      if (error.error !== 'LIMIT_EXCEEDED') {
        console.error('API Error:', response.status, errorText);
      }
      throw new Error(error.message || `Error ${response.status}`, {
        cause: error,
      });
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(errorText || `Error ${response.status}`);
      }
      throw e;
    }
  }

  return response.json() as Promise<T>;
}