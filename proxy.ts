import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// The only open route — all other /dashboard/* paths redirect to /locked
const OPEN_PATH = '/dashboard/activation/purchase-cohorts';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only intercept dashboard routes
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  // Product North Star is always open regardless of auth
  if (pathname.startsWith(OPEN_PATH)) {
    return NextResponse.next();
  }

  // All other dashboard routes are locked — redirect to locked page
  const locked = new URL('/locked', request.url);
  locked.searchParams.set('from', pathname);
  return NextResponse.redirect(locked);
}

export const config = {
  matcher: '/dashboard/:path*',
};
