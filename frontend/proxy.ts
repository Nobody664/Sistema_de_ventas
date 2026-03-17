import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/',
    '/dashboard/:path*',
    '/products/:path*',
    '/categories/:path*',
    '/sales/:path*',
    '/customers/:path*',
    '/employees/:path*',
    '/reports/:path*',
    '/companies/:path*',
    '/subscribers/:path*',
    '/upgrade-requests/:path*',
    '/subscriptions/:path*',
    '/audit/:path*',
    '/notifications/:path*',
    '/settings/:path*',
    '/invoices/:path*',
    '/profile/:path*',
    '/api/:path*',
  ],
};

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const publicPaths = ['/', '/sign-in', '/sign-up', '/register', '/api/auth', '/pricing', '/contact'];
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path + '/'));
  
  const isApiRoute = pathname.startsWith('/api');
  const isNextAuthApi = pathname.startsWith('/api/auth');
  const isPublicApi = pathname === '/api/auth/register' || isNextAuthApi || pathname === '/api/auth/login' || pathname === '/api/auth/callback' || pathname === '/api/auth/session';

  if (isPublicPath && !isApiRoute) {
    if (isLoggedIn && (pathname === '/sign-in' || pathname === '/sign-up' || pathname === '/register')) {
      return Response.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  if (isApiRoute && isPublicApi) {
    return NextResponse.next();
  }

  if (!isLoggedIn && !isPublicPath) {
    if (isApiRoute) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return Response.redirect(new URL('/sign-in', req.url));
  }

  return NextResponse.next();
});
