import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export { auth as middleware };

export const config = {
  matcher: ['/dashboard/:path*', '/api/v1/:path*', '/sign-in', '/sign-up'],
};

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isOnDashboard = pathname.startsWith('/dashboard');
  const isOnApi = pathname.startsWith('/api/v1');
  const isOnAuthRoute = pathname.startsWith('/sign-in') || pathname.startsWith('/api/auth');

  if (!isLoggedIn && isOnDashboard) {
    return Response.redirect(new URL('/sign-in', req.url));
  }

  if (!isLoggedIn && isOnApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isLoggedIn && isOnAuthRoute) {
    return Response.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
});
