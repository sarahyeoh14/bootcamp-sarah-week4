import { NextRequest, NextResponse } from 'next/server';
import { encodeSession, nameFromEmail } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const proto = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host') || 'localhost:3000';
  const origin = `${proto}://${host}`;

  const loginUrl = (err: string) => new URL(`/login?error=${err}`, origin);

  if (error) {
    return NextResponse.redirect(loginUrl('oauth'));
  }

  const savedState = request.cookies.get('oauth_state')?.value;
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(loginUrl('state'));
  }

  if (!code) {
    return NextResponse.redirect(loginUrl('no_code'));
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${origin}/api/auth/callback/google`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(loginUrl('token'));
  }

  const tokens = await tokenRes.json();

  // Get user info
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userInfoRes.ok) {
    return NextResponse.redirect(loginUrl('userinfo'));
  }

  const userInfo = await userInfoRes.json();
  const email: string = (userInfo.email ?? '').toLowerCase();

  if (!email.endsWith('@mindvalley.com')) {
    return NextResponse.redirect(loginUrl('domain'));
  }

  const session = {
    name: (userInfo.name as string | undefined) ?? nameFromEmail(email),
    email,
    role: 'Product' as const,
  };

  const response = NextResponse.redirect(new URL('/dashboard', origin));

  response.cookies.set('mv_session', encodeSession(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  // Clear OAuth state cookie
  response.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });

  return response;
}
