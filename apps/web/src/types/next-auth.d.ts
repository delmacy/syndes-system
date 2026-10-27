import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth/jwt' {
  interface JWT {
    /** Server-only Keycloak access token; never copied into the client session. */
    accessToken?: string;
    /** Server-only ID token used for Keycloak RP-initiated logout. */
    idToken?: string;
  }
}
