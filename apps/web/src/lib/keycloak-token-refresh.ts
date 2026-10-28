import type { JWT } from "next-auth/jwt";

type KeycloakRefreshResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  refresh_token?: unknown;
  id_token?: unknown;
};

export interface KeycloakRefreshOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  now?: number;
  refreshSkewMs?: number;
  fetcher?: typeof fetch;
}

export async function refreshKeycloakAccessToken(
  token: JWT,
  options: KeycloakRefreshOptions,
): Promise<JWT> {
  const now = options.now ?? Date.now();
  const refreshSkewMs = options.refreshSkewMs ?? 30_000;
  const expiresAt = token.accessTokenExpiresAt;

  if (
    typeof token.accessToken === "string" &&
    typeof expiresAt === "number" &&
    expiresAt - now > refreshSkewMs
  ) {
    return token;
  }

  if (typeof token.refreshToken !== "string" || typeof expiresAt !== "number") {
    return refreshFailed(token);
  }

  try {
    const response = await (options.fetcher ?? fetch)(
      `${options.issuer.replace(/\/$/, "")}/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: options.clientId,
          client_secret: options.clientSecret,
          refresh_token: token.refreshToken,
        }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );

    if (!response.ok) return refreshFailed(token);

    const result = (await response.json()) as KeycloakRefreshResponse;
    if (
      typeof result.access_token !== "string" ||
      typeof result.expires_in !== "number" ||
      !Number.isFinite(result.expires_in) ||
      result.expires_in <= 0
    ) {
      return refreshFailed(token);
    }

    return {
      ...token,
      accessToken: result.access_token,
      accessTokenExpiresAt: now + result.expires_in * 1000,
      refreshToken:
        typeof result.refresh_token === "string"
          ? result.refresh_token
          : token.refreshToken,
      ...(typeof result.id_token === "string" ? { idToken: result.id_token } : {}),
      authError: undefined,
    };
  } catch {
    return refreshFailed(token);
  }
}

function refreshFailed(token: JWT): JWT {
  return {
    ...token,
    accessToken: undefined,
    authError: "RefreshTokenError",
  };
}

