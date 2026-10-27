import { describe, expect, it } from 'vitest';
import {
  authJsTransientCookieNames,
  buildKeycloakLogoutUrl,
} from './keycloak-logout';

describe('buildKeycloakLogoutUrl', () => {
  it('builds the Keycloak RP-initiated logout URL with id_token_hint', () => {
    const url = buildKeycloakLogoutUrl({
      issuer: 'https://identity.example.test/realms/syndes/',
      idToken: 'id-token-value',
      postLogoutRedirectOrigin: 'https://crm.example.test',
      clientId: 'syndes-web',
    });
    expect(url.origin + url.pathname).toBe(
      'https://identity.example.test/realms/syndes/protocol/openid-connect/logout',
    );
    expect(url.searchParams.get('id_token_hint')).toBe('id-token-value');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe(
      'https://crm.example.test',
    );
    expect(url.searchParams.get('client_id')).toBe('syndes-web');
  });
});

describe('authJsTransientCookieNames', () => {
  it('lists Auth.js cookie names with secure prefixes for production clears', () => {
    expect(authJsTransientCookieNames(true)).toEqual([
      '__Secure-authjs.callback-url',
      '__Host-authjs.csrf-token',
      '__Secure-authjs.pkce.code_verifier',
      '__Secure-authjs.state',
      '__Secure-authjs.nonce',
    ]);
  });
});
