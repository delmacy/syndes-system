jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => ({ mockJwks: true })),
  jwtVerify: jest.fn(),
}));

import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { IdentityAuthGuard, type IdentityRequest } from './identity-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { TenantContextGuard } from './tenant-context.guard';
import {
  VALIDATED_TENANT_HOST_HEADER,
  VALIDATED_TENANT_SIGNATURE_HEADER,
  VALIDATED_TENANT_TIME_HEADER,
  signValidatedHost,
} from './trusted-ingress';
import type { IdentityContextService } from './identity-context.service';
import type {
  VerifiedIdentity,
  IdentityTokenVerifier,
} from './identity-token-verifier';
import type {
  AuthenticatedActor,
  IdentityRequestContext,
  TenantContext,
} from './identity.contracts';

const identity: VerifiedIdentity = {
  issuer: 'https://id.test/realms/syndes',
  subject: 'subject-1',
  audience: ['syndes-api'],
  authorizedParty: 'syndes-web',
  acr: 'mfa',
};

const actor: AuthenticatedActor = {
  id: 'actor-1',
  issuer: identity.issuer,
  subject: identity.subject,
  platformAdmin: false,
};

const tenant: TenantContext = {
  actorId: actor.id,
  tenantId: 'tenant-1',
  databaseName: 'sdb_tenant',
  role: 'tenant_member',
  customerScope: 'pj',
};

const ingressSecret = 'test-only ingress secret that is never deployed';

function requestFor(request: IdentityRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function requestWith(
  headers: Record<string, string>,
  identityContext?: IdentityRequestContext,
): IdentityRequest {
  return { headers, identityContext } as unknown as IdentityRequest;
}

function verifierReturning(value: VerifiedIdentity) {
  const verify = jest.fn().mockResolvedValue(value);
  return {
    verify,
    verifier: { verify } as unknown as IdentityTokenVerifier,
  };
}

function contextsReturning(actorValue: AuthenticatedActor) {
  const resolveActor = jest.fn().mockResolvedValue(actorValue);
  const resolveTenantContext = jest.fn().mockResolvedValue(tenant);
  const resolvePlatformAdmin = jest.fn().mockResolvedValue(undefined);
  return {
    resolveActor,
    resolveTenantContext,
    resolvePlatformAdmin,
    contexts: {
      resolveActor,
      resolveTenantContext,
      resolvePlatformAdmin,
    } as unknown as IdentityContextService,
  };
}

describe('identity request guards', () => {
  const original = process.env.INGRESS_SIGNING_SECRET;
  beforeEach(() => {
    process.env.INGRESS_SIGNING_SECRET = ingressSecret;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.INGRESS_SIGNING_SECRET;
    else process.env.INGRESS_SIGNING_SECRET = original;
  });

  function signedRequest(host = 'crm.example.test'): IdentityRequest {
    const timestamp = String(Date.now());
    return requestWith(
      {
        authorization: 'Bearer token',
        [VALIDATED_TENANT_HOST_HEADER]: host,
        [VALIDATED_TENANT_TIME_HEADER]: timestamp,
        [VALIDATED_TENANT_SIGNATURE_HEADER]: signValidatedHost(
          'crm.example.test',
          timestamp,
          ingressSecret,
        ),
      },
      { actor },
    );
  }

  describe(IdentityAuthGuard.name, () => {
    it('rejects requests without a valid bearer credential', async () => {
      const { verify, verifier } = verifierReturning(identity);
      const { contexts } = contextsReturning(actor);
      const guard = new IdentityAuthGuard(verifier, contexts);
      await expect(
        guard.canActivate(requestFor(requestWith({}))),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        guard.canActivate(
          requestFor(requestWith({ authorization: 'Basic abc' })),
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(verify).not.toHaveBeenCalled();
    });

    it('attaches the Control Plane-resolved actor, not token claims', async () => {
      const { verify, verifier } = verifierReturning(identity);
      const { contexts } = contextsReturning({ ...actor, platformAdmin: true });
      const guard = new IdentityAuthGuard(verifier, contexts);
      const request = requestWith({ authorization: 'Bearer token' });
      await expect(guard.canActivate(requestFor(request))).resolves.toBe(true);
      expect(verify).toHaveBeenCalledWith('token');
      expect(request.identityContext?.actor.platformAdmin).toBe(true);
    });
  });

  describe(TenantContextGuard.name, () => {
    it('never grants tenant access to a platform administrator', async () => {
      const { resolveTenantContext, contexts } = contextsReturning(actor);
      const guard = new TenantContextGuard(contexts);
      const request = signedRequest();
      request.identityContext = {
        actor: { ...actor, platformAdmin: true },
      };
      await expect(guard.canActivate(requestFor(request))).rejects.toThrow(
        NotFoundException,
      );
      expect(resolveTenantContext).not.toHaveBeenCalled();
    });

    it('rejects a host that the ingress did not sign', async () => {
      const { resolveTenantContext, contexts } = contextsReturning(actor);
      const guard = new TenantContextGuard(contexts);
      await expect(
        guard.canActivate(requestFor(signedRequest('other.example.test'))),
      ).rejects.toThrow(NotFoundException);
      expect(resolveTenantContext).not.toHaveBeenCalled();
    });

    it('binds the tenant context to the signed host and membership', async () => {
      const { resolveTenantContext, contexts } = contextsReturning(actor);
      const guard = new TenantContextGuard(contexts);
      const request = signedRequest();
      await expect(guard.canActivate(requestFor(request))).resolves.toBe(true);
      expect(resolveTenantContext).toHaveBeenCalledTimes(1);
      expect(resolveTenantContext).toHaveBeenCalledWith(
        actor.id,
        'crm.example.test',
      );
      expect(request.identityContext?.tenant).toEqual(tenant);
    });
  });

  describe(PlatformAdminGuard.name, () => {
    it('requires acr=mfa before resolving any manager identity', async () => {
      const { verifier } = verifierReturning({ ...identity, acr: '1' });
      const { resolveActor, contexts } = contextsReturning({
        ...actor,
        platformAdmin: true,
      });
      const guard = new PlatformAdminGuard(verifier, contexts);
      await expect(
        guard.canActivate(
          requestFor(requestWith({ authorization: 'Bearer token' })),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(resolveActor).not.toHaveBeenCalled();
    });

    it('denies a verified identity that is not a Control Plane platform admin', async () => {
      const guard = new PlatformAdminGuard(
        verifierReturning(identity).verifier,
        contextsReturning(actor).contexts,
      );
      await expect(
        guard.canActivate(
          requestFor(requestWith({ authorization: 'Bearer token' })),
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('accepts an MFA platform admin from the Control Plane record', async () => {
      const { resolvePlatformAdmin, contexts } = contextsReturning({
        ...actor,
        platformAdmin: true,
      });
      const guard = new PlatformAdminGuard(
        verifierReturning(identity).verifier,
        contexts,
      );
      const request = requestWith({ authorization: 'Bearer token' });
      await expect(guard.canActivate(requestFor(request))).resolves.toBe(true);
      expect(resolvePlatformAdmin).toHaveBeenCalledWith(actor.id);
      expect(request.identityContext?.actor.platformAdmin).toBe(true);
    });
  });
});
