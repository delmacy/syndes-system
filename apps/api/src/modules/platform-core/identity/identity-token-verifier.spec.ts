jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({ mockJwks: true })),
  jwtVerify: jest.fn(),
}));

import { createRemoteJWKSet, jwtVerify } from 'jose';
import { UnauthorizedException } from '@nestjs/common';
import { IdentityTokenVerifier } from './identity-token-verifier';

describe('Keycloak access token verification contract', () => {
  const original = { ...process.env };
  beforeEach(() => {
    process.env.KEYCLOAK_ISSUER = 'https://id.example.test/realms/syndes';
    process.env.KEYCLOAK_API_AUDIENCE = 'syndes-api';
    process.env.KEYCLOAK_ALLOWED_AZP = 'syndes-web,syndes-manager';
    jest.clearAllMocks();
  });
  afterAll(() => {
    for (const key of [
      'KEYCLOAK_ISSUER',
      'KEYCLOAK_API_AUDIENCE',
      'KEYCLOAK_ALLOWED_AZP',
    ])
      delete process.env[key];
    Object.assign(process.env, original);
  });

  it('verifies the exact issuer and API audience using RS256 and accepts configured clients', async () => {
    (jwtVerify as jest.Mock).mockResolvedValue({
      payload: {
        iss: 'https://id.example.test/realms/syndes',
        sub: 'subject-1',
        aud: ['syndes-api'],
        azp: 'syndes-web',
        acr: 'mfa',
      },
    });
    const verifier = new IdentityTokenVerifier();
    await expect(verifier.verify('signed-token')).resolves.toEqual({
      issuer: 'https://id.example.test/realms/syndes',
      subject: 'subject-1',
      audience: ['syndes-api'],
      authorizedParty: 'syndes-web',
      acr: 'mfa',
    });
    expect(createRemoteJWKSet).toHaveBeenCalledWith(
      new URL(
        'https://id.example.test/realms/syndes/protocol/openid-connect/certs',
      ),
    );
    expect(jwtVerify).toHaveBeenCalledWith(
      'signed-token',
      { mockJwks: true },
      expect.objectContaining({
        issuer: 'https://id.example.test/realms/syndes',
        audience: 'syndes-api',
        algorithms: ['RS256'],
        requiredClaims: ['exp'],
      }),
    );
  });

  it('rejects malformed claims and JWT validation failures without leaking token details', async () => {
    (jwtVerify as jest.Mock).mockResolvedValueOnce({
      payload: {
        iss: 'https://id.example.test/realms/syndes',
        sub: 'subject-1',
        aud: 'syndes-api',
        azp: 'untrusted-client',
      },
    });
    await expect(
      new IdentityTokenVerifier().verify('secret-token'),
    ).rejects.toThrow(UnauthorizedException);
    (jwtVerify as jest.Mock).mockRejectedValueOnce(
      new Error('sensitive token diagnostic'),
    );
    await expect(
      new IdentityTokenVerifier().verify('secret-token'),
    ).rejects.toThrow('Invalid bearer token');
  });
});
