import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/pricing',
  '/plan-expired',
  '/account-suspended',
  '/forbidden',
  '/api',
  '/_next',
  '/favicon',
];

function readCompanyStatus(accessToken: string): string | undefined {
  const parts = accessToken.split('.');
  if (parts.length < 2) return undefined;

  try {
    const payload = JSON.parse(atob(parts[1]));
    return typeof payload.companyStatus === 'string' ? payload.companyStatus : undefined;
  } catch {
    return undefined;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  if (isPublicRoute) return NextResponse.next();

  const accessToken = request.cookies.get('access_token')?.value;

  if (!accessToken) {
    const url = new URL('/sign-in', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  const companyStatus = readCompanyStatus(accessToken);

  if (companyStatus === 'INACTIVE') {
    return NextResponse.redirect(new URL('/plan-expired', request.url));
  }

  if (companyStatus === 'SUSPENDED' || companyStatus === 'PAST_DUE') {
    return NextResponse.redirect(new URL('/account-suspended', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};