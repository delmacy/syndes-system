import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import {
  authJsTransientCookieNames,
  buildKeycloakLogoutUrl,
} from '@/lib/keycloak-logout';
import { isSameApplicationOrigin } from '@/lib/request-origin';
import {
  sessionCookieName,
  sessionCookieOptions,
} from '@/lib/session-cookie';

export async function POST(request: NextRequest) {
  const applicationUrl = process.env.AUTH_URL;
  if (
    !isSameApplicationOrigin(request.headers.get('origin'), applicationUrl)
  ) {
    return new NextResponse(null, { status: 403 });
  }

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    cookieName: sessionCookieName(),
  });
  const idToken = typeof token?.idToken === 'string' ? token.idToken : undefined;
  const issuer = process.env.KEYCLOAK_ISSUER?.trim();
  const clientId = process.env.KEYCLOAK_WEB_CLIENT_ID?.trim();
  if (!issuer || !idToken || !clientId || !applicationUrl) {
    return NextResponse.json(
      { error: 'No active Keycloak session' },
      { status: 401 },
    );
  }

  const logout = buildKeycloakLogoutUrl({
    issuer,
    idToken,
    postLogoutRedirectOrigin: new URL(applicationUrl).origin,
    clientId,
  });

  const response = NextResponse.redirect(logout, 303);
  const cookieOptions = { ...sessionCookieOptions(), maxAge: 0 };
  response.cookies.set(sessionCookieName(), '', cookieOptions);

  const secure = process.env.NODE_ENV === 'production';
  for (const name of authJsTransientCookieNames(secure)) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure,
      maxAge: 0,
    });
  }

  return response;
}
