import { NextRequest, NextResponse } from 'next/server';
import { encodeSession, VALID_ROLES, roleToPath, Role } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, role } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role as Role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const session = { name: name.trim(), role: role as Role };
  const encoded = encodeSession(session);
  const redirectPath = roleToPath(role as Role);

  const response = NextResponse.json({ ok: true, redirectTo: redirectPath });
  response.cookies.set('mv_session', encoded, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
