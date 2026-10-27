import NextAuth from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import {
  sessionCookieName,
  sessionCookieOptions,
} from '@/lib/session-cookie';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Keycloak({
      issuer: required('KEYCLOAK_ISSUER'),
      clientId: required('KEYCLOAK_WEB_CLIENT_ID'),
      clientSecret: required('KEYCLOAK_WEB_CLIENT_SECRET'),
      allowDangerousEmailAccountLinking: false,
      // Authorization Code + PKCE S256 + state + nonce (Auth.js defaults to pkce only).
      checks: ['pkce', 'state', 'nonce'],
      authorization: {
        params: {
          scope: 'openid profile email',
          code_challenge_method: 'S256',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  cookies: {
    sessionToken: {
      name: sessionCookieName(),
      options: sessionCookieOptions(),
    },
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.idToken = account.id_token;
      }
      return token;
    },
    async session({ session }) {
      // OAuth tokens stay encrypted in the server-only JWT cookie — never expose them here.
      return {
        expires: session.expires,
        user: session.user
          ? {
              name: session.user.name ?? null,
              email: session.user.email ?? null,
              image: session.user.image ?? null,
            }
          : undefined,
      };
    },
  },
});

/** Manager entrypoints call this server action to request the configured Keycloak MFA ACR. */
export async function signInPlatformAdmin() {
  'use server';
  await signIn('keycloak', {
    authorizationParams: { acr_values: 'mfa' },
    redirectTo: '/platform-admin',
  });
}
