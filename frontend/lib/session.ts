import { cache } from "react";
import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  getSetCookieHeaders,
  readSetCookieValue,
} from "@/lib/auth-cookies";
import { BACKEND_API_URL } from "@/lib/backend-url";
import { parseSessionUser, type SessionUser } from "@/lib/session-contract";

export type ServerSessionUser = SessionUser;

export interface ServerSession {
  user: ServerSessionUser | null;
  accessToken: string | undefined;
  refreshToken: string | undefined;
}

interface RefreshedTokens {
  accessToken: string;
  refreshToken: string | undefined;
}

async function refreshServerTokens(
  refreshToken: string,
): Promise<RefreshedTokens | null> {
  try {
    const response = await fetch(`${BACKEND_API_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}`,
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!response.ok) return null;

    const setCookies = getSetCookieHeaders(response.headers);
    const accessToken = readSetCookieValue(setCookies, ACCESS_COOKIE);
    if (!accessToken) return null;

    return {
      accessToken,
      refreshToken: readSetCookieValue(setCookies, REFRESH_COOKIE),
    };
  } catch {
    return null;
  }
}

async function fetchCurrentUser(accessToken: string): Promise<unknown | null> {
  const response = await fetch(`${BACKEND_API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return null;
  return response.json() as Promise<unknown>;
}

export const getServerSession = cache(
  async (): Promise<ServerSession | null> => {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
    const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

    if (!accessToken && !refreshToken) {
      return null;
    }

    let activeAccessToken = accessToken;
    let activeRefreshToken = refreshToken;
    let payload: unknown | null = null;

    if (activeAccessToken) {
      try {
        payload = await fetchCurrentUser(activeAccessToken);
      } catch {
        payload = null;
      }
    }

    if (!payload && activeRefreshToken) {
      const refreshed = await refreshServerTokens(activeRefreshToken);
      if (refreshed) {
        activeAccessToken = refreshed.accessToken;
        activeRefreshToken = refreshed.refreshToken ?? activeRefreshToken;
        try {
          payload = await fetchCurrentUser(activeAccessToken);
        } catch {
          payload = null;
        }
      }
    }

    if (!payload || !activeAccessToken) {
      return null;
    }

    try {
      return {
        user: parseSessionUser(payload),
        accessToken: activeAccessToken,
        refreshToken: activeRefreshToken,
      };
    } catch {
      return null;
    }
  },
);
