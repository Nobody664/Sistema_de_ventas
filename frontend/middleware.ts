import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_ROUTES = [
  '/sign-in',
  '/sign-up',
  '/sign-up/',
  '/api/auth',
  '/pricing',
  '/plan-expired',
  '/account-suspended',
  '/forbidden',
  '/_next',
  '/favicon',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  if (isPublicRoute) return NextResponse.next();

  const accessToken = request.cookies.get('accessToken')?.value;
  if (!accessToken) return NextResponse.next();

  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    const companyStatus: string | undefined = payload.companyStatus;

    if (companyStatus === 'INACTIVE') {
      return NextResponse.redirect(new URL('/plan-expired', request.url));
    }

    if (companyStatus === 'SUSPENDED' || companyStatus === 'PAST_DUE') {
      return NextResponse.redirect(new URL('/account-suspended', request.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
