import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isJwtExpired, readJwtClaim } from "@/lib/auth-token";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  getSetCookieHeaders,
  readSetCookieValue,
} from "@/lib/auth-cookies";
import { BACKEND_API_URL } from "@/lib/backend-url";

const PUBLIC_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/pricing",
  "/plan-expired",
  "/account-suspended",
  "/forbidden",
  "/api",
  "/_next",
  "/favicon",
];

interface RefreshedSession {
  accessToken: string;
  refreshToken: string;
  setCookies: string[];
}

async function refreshSession(
  request: NextRequest,
): Promise<RefreshedSession | null> {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

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
      refreshToken:
        readSetCookieValue(setCookies, REFRESH_COOKIE) ?? refreshToken,
      setCookies,
    };
  } catch {
    return null;
  }
}

function applyRefreshedCookies(
  response: NextResponse,
  setCookies: readonly string[],
): NextResponse {
  for (const cookie of setCookies) {
    response.headers.append("set-cookie", cookie);
  }
  return response;
}

function signInRedirect(request: NextRequest): NextResponse {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("redirect", request.nextUrl.pathname);
  const response = NextResponse.redirect(url);
  response.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute =
    pathname === "/" ||
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  if (isPublicRoute) return NextResponse.next();

  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  let refreshedSetCookies: string[] = [];

  if (!accessToken || isJwtExpired(accessToken)) {
    const refreshed = await refreshSession(request);

    if (!refreshed) {
      return signInRedirect(request);
    }

    accessToken = refreshed.accessToken;
    refreshedSetCookies = refreshed.setCookies;
    request.cookies.set(ACCESS_COOKIE, refreshed.accessToken);
    request.cookies.set(REFRESH_COOKIE, refreshed.refreshToken);
  }

  const isPlatformRoute =
    pathname === "/platform" || pathname.startsWith("/platform/");

  if (isPlatformRoute) {
    const roles = readJwtClaim(accessToken, "roles");
    const isPlatformAdmin =
      Array.isArray(roles) &&
      roles.some((role) => role === "SUPER_ADMIN" || role === "SUPPORT_ADMIN");

    if (!isPlatformAdmin) {
      return applyRefreshedCookies(
        NextResponse.redirect(new URL("/forbidden", request.url)),
        refreshedSetCookies,
      );
    }

    return applyRefreshedCookies(
      NextResponse.next({ request }),
      refreshedSetCookies,
    );
  }

  const companyStatus = readJwtClaim(accessToken, "companyStatus");

  if (companyStatus === "INACTIVE") {
    return applyRefreshedCookies(
      NextResponse.redirect(new URL("/plan-expired", request.url)),
      refreshedSetCookies,
    );
  }

  if (companyStatus === "SUSPENDED" || companyStatus === "PAST_DUE") {
    return applyRefreshedCookies(
      NextResponse.redirect(new URL("/account-suspended", request.url)),
      refreshedSetCookies,
    );
  }

  return applyRefreshedCookies(
    NextResponse.next({ request }),
    refreshedSetCookies,
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
