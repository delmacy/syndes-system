/** Host-only Auth.js session cookie: no Domain attribute; __Host- in production. */

export function sessionCookieName(nodeEnv = process.env.NODE_ENV): string {
  return nodeEnv === 'production'
    ? '__Host-syndes.session-token'
    : 'syndes.session-token';
}

export function sessionCookieOptions(nodeEnv = process.env.NODE_ENV) {
  const secure = nodeEnv === 'production';
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    path: '/' as const,
    secure,
    // Omit domain so the cookie is host-only (required for __Host-).
  };
}
