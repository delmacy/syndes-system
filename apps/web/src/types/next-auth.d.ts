import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    /** Internal server-side API credential; stripped from public session responses. */
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    /** Server-only Keycloak access token; the public session handler strips it. */
    accessToken?: string;
    /** Server-only Keycloak refresh token stored in the encrypted Auth.js JWT. */
    refreshToken?: string;
    /** Access-token expiry in milliseconds since epoch. */
    accessTokenExpiresAt?: number;
    /** Server-only ID token used for Keycloak RP-initiated logout. */
    idToken?: string;
    /** Set when refresh fails; never sent to the browser. */
    authError?: 'RefreshTokenError';
  }
}
