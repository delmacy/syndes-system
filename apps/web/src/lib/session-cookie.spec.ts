import { describe, expect, it } from 'vitest';
import { sessionCookieName, sessionCookieOptions } from './session-cookie';

describe('session cookie', () => {
  it('uses a __Host- prefixed host-only cookie in production', () => {
    expect(sessionCookieName('production')).toBe('__Host-syndes.session-token');
    const options = sessionCookieOptions('production');
    expect(options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
    });
    expect(options).not.toHaveProperty('domain');
  });

  it('uses a non-prefixed cookie for local development', () => {
    expect(sessionCookieName('development')).toBe('syndes.session-token');
    expect(sessionCookieOptions('development').secure).toBe(false);
  });
});
