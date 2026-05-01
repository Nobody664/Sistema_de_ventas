export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  name?: string;
  roles: string[];
  companyId: string | null;
  planCode: string | null;
  subscriptionStatus: string | null;
}

export interface Session {
  user: SessionUser | null;
  accessToken?: string;
  refreshToken?: string;
}

export async function auth(): Promise<Session | null> {
  return {
    user: null,
    accessToken: undefined,
    refreshToken: undefined,
  };
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').replace(/\/$/, '');

export async function getAccessToken(): Promise<string | null> {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  
  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      credentials: 'include',
    });
    
    if (response.ok) {
      return response.headers.get('set-cookie') || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchWithAuth<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }
}

export function clearTokens(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}

export function getAccessTokenSync(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken');
}

export const session = {
  user: null,
  accessToken: undefined,
  refreshToken: undefined,
};