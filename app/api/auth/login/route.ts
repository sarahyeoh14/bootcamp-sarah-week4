import { NextRequest, NextResponse } from 'next/server';
import { encodeSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name } = body;

  if (!name || typeof name !== 'string' || name.trim().length < 1) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const session = { name: name.trim(), role: 'Product' as const };
  const encoded = encodeSession(session);

  const response = NextResponse.json({ ok: true, redirectTo: '/dashboard' });
  response.cookies.set('mv_session', encoded, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
