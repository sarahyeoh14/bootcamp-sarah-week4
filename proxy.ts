import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function getSessionEmail(request: NextRequest): string | null {
  const raw = request.cookies.get('mv_session')?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    return typeof parsed?.email === 'string' ? parsed.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept dashboard routes
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  // Authenticated @mindvalley.com users have access to all dashboard routes
  const email = getSessionEmail(request);
  if (email && email.endsWith('@mindvalley.com')) {
    return NextResponse.next();
  }

  // Unauthenticated — redirect to login (dashboard layout will also enforce this)
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: '/dashboard/:path*',
};
