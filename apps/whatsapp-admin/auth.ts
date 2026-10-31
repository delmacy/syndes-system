import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";

// The Keycloak OIDC client must put realm_access.roles into the ID token.
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Keycloak],
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  callbacks: {
    async signIn({ profile }) {
      if (!profile) return false;
      const candidate = profile as typeof profile & {
        realm_access?: { roles?: unknown };
      };
      const roles = candidate.realm_access?.roles;
      if (!Array.isArray(roles)) return false;
      return roles.includes(process.env.AUTH_ADMIN_ROLE || "syndes-gateway-admin");
    },
  },
});
