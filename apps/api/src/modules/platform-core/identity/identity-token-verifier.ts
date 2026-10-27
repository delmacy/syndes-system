import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { readIdentityConfig } from './identity-config';

export interface VerifiedIdentity {
  issuer: string;
  subject: string;
  audience: string[];
  authorizedParty: string;
  acr?: string;
}

@Injectable()
export class IdentityTokenVerifier {
  private readonly config = readIdentityConfig();
  private readonly jwks = createRemoteJWKSet(this.config.jwksUrl);

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp'],
      });
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        typeof payload.azp !== 'string' ||
        !this.config.authorizedParties.has(payload.azp)
      )
        throw new UnauthorizedException();
      return {
        issuer: payload.iss!,
        subject: payload.sub,
        audience: Array.isArray(payload.aud)
          ? payload.aud
          : [payload.aud as string],
        authorizedParty: payload.azp,
        acr: typeof payload.acr === 'string' ? payload.acr : undefined,
      };
    } catch {
      throw new UnauthorizedException('Invalid bearer token');
    }
  }
}
