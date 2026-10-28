import { describe, expect, it, vi } from "vitest";
import {
  refreshKeycloakAccessToken,
  type KeycloakRefreshOptions,
} from "./keycloak-token-refresh";

const baseToken = {
  accessToken: "old-access-token",
  accessTokenExpiresAt: 10_000,
  refreshToken: "old-refresh-token",
};

const baseOptions: KeycloakRefreshOptions = {
  issuer: "https://identity.example.test/realms/syndes/",
  clientId: "syndes-web",
  clientSecret: "server-only-client-secret",
  now: 20_000,
  refreshSkewMs: 1_000,
};

describe("refreshKeycloakAccessToken", () => {
  it("returns an access token that remains valid without contacting Keycloak", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const token = {
      ...baseToken,
      accessTokenExpiresAt: 30_000,
    };

    await expect(
      refreshKeycloakAccessToken(token, { ...baseOptions, fetcher }),
    ).resolves.toEqual(token);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and keeps a rotated refresh token server-side", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        access_token: "new-access-token",
        refresh_token: "new-refresh-token",
        id_token: "new-id-token",
        expires_in: 300,
      }),
    );

    const result = await refreshKeycloakAccessToken(baseToken, {
      ...baseOptions,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://identity.example.test/realms/syndes/protocol/openid-connect/token",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: expect.any(URLSearchParams),
      }),
    );
    const request = fetcher.mock.calls[0][1];
    expect(new URLSearchParams(request?.body as URLSearchParams).get("grant_type"))
      .toBe("refresh_token");
    expect(result).toMatchObject({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token",
      idToken: "new-id-token",
      accessTokenExpiresAt: 320_000,
    });
    expect(result.authError).toBeUndefined();
  });

  it("clears an expired access token when refresh fails", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 400 }),
    );

    const result = await refreshKeycloakAccessToken(baseToken, {
      ...baseOptions,
      fetcher,
    });

    expect(result.accessToken).toBeUndefined();
    expect(result.authError).toBe("RefreshTokenError");
    expect(result.refreshToken).toBe("old-refresh-token");
  });
});
