import NextAuth from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import {
  sessionCookieName,
  sessionCookieOptions,
} from '@/lib/session-cookie';
import { refreshKeycloakAccessToken } from '@/lib/keycloak-token-refresh';

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
        token.refreshToken = account.refresh_token;
        token.idToken = account.id_token;
        token.accessTokenExpiresAt = account.expires_at
          ? account.expires_at * 1000
          : account.expires_in
            ? Date.now() + account.expires_in * 1000
            : undefined;
        token.authError = undefined;
        return token;
      }

      return refreshKeycloakAccessToken(token, {
        issuer: required('KEYCLOAK_ISSUER'),
        clientId: required('KEYCLOAK_WEB_CLIENT_ID'),
        clientSecret: required('KEYCLOAK_WEB_CLIENT_SECRET'),
        refreshSkewMs: Number(process.env.KEYCLOAK_TOKEN_REFRESH_SKEW_MS) || 30_000,
      });
    },
    async session({ session, token }) {
      // The API proxy consumes this server-side session field. The public
      // /api/auth/session handler removes it before sending a response.
      return {
        expires: session.expires,
        accessToken: token.accessToken,
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
