import { readIdentityConfig } from './identity-config';

describe('Keycloak API identity configuration', () => {
  it('requires explicit issuer, audience, and authorized client values', () => {
    expect(() => readIdentityConfig({})).toThrow('KEYCLOAK_ISSUER is required');
    expect(() =>
      readIdentityConfig({
        KEYCLOAK_ISSUER: 'https://id.test/realms/syndes',
      }),
    ).toThrow('KEYCLOAK_ALLOWED_AZP is required');
    expect(() =>
      readIdentityConfig({
        KEYCLOAK_ISSUER: 'https://id.test/realms/syndes',
        KEYCLOAK_ALLOWED_AZP: 'crm-web',
      }),
    ).toThrow('KEYCLOAK_API_AUDIENCE is required');
  });

  it('pins JWKS to the exact issuer and accepts only the configured client IDs', () => {
    const config = readIdentityConfig({
      KEYCLOAK_ISSUER: 'https://id.test/realms/syndes/',
      KEYCLOAK_API_AUDIENCE: 'syndes-api',
      KEYCLOAK_ALLOWED_AZP: 'syndes-web, syndes-manager',
    });
    expect(config.issuer).toBe('https://id.test/realms/syndes');
    expect(config.audience).toBe('syndes-api');
    expect(config.jwksUrl.toString()).toBe(
      'https://id.test/realms/syndes/protocol/openid-connect/certs',
    );
    expect(config.authorizedParties.has('syndes-manager')).toBe(true);
    expect(config.authorizedParties.has('untrusted-client')).toBe(false);
  });
});
