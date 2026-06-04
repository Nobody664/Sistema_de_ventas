import { cache } from 'react';
import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface ServerSessionUser {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  companyId: string | null;
  companyStatus: string | null;
  planCode: string | null;
  subscriptionStatus: string | null;
  trialEndsAt?: string | null;
}

export interface ServerSession {
  user: ServerSessionUser | null;
  accessToken: string | undefined;
  refreshToken: string | undefined;
}

export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('accessToken')?.value;
  
  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return {
      user,
      accessToken,
      refreshToken: cookieStore.get('refreshToken')?.value,
    };
  } catch {
    return null;
  }
});