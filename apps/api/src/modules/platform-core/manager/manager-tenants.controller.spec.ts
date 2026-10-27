jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(),
  jwtVerify: jest.fn(),
}));

import {
  ForbiddenException,
  HttpStatus,
  UnauthorizedException,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PlatformAdminGuard } from '../identity/platform-admin.guard';
import { IdentityContextService } from '../identity/identity-context.service';
import { IdentityTokenVerifier } from '../identity/identity-token-verifier';
import type {
  AuthenticatedActor,
  VerifiedIdentity,
} from '../identity/identity.contracts';
import {
  MANAGER_PROBLEM_DETAILS_FILTER,
  ManagerProblemException,
} from './manager-problem-details';
import { MANAGER_CONFIGURED_KEYCLOAK_ISSUER } from './manager.module';
import {
  ManagerTenantsService,
  type TenantDetailResource,
  type TenantListResult,
} from './manager-tenants.service';
import { ManagerTenantsController } from './manager-tenants.controller';

const configuredIssuer = 'https://id.test/realms/syndes';

const adminActor: AuthenticatedActor = {
  id: 'admin-actor',
  issuer: configuredIssuer,
  subject: 'admin-subject',
  platformAdmin: true,
};

const memberActor: AuthenticatedActor = {
  id: 'member-actor',
  issuer: configuredIssuer,
  subject: 'member-subject',
  platformAdmin: false,
};

function identityFor(name: 'admin' | 'member', acr?: string): VerifiedIdentity {
  return {
    issuer: configuredIssuer,
    subject: name === 'admin' ? 'admin-subject' : 'member-subject',
    audience: ['syndes-api'],
    authorizedParty: 'syndes-web',
    ...(acr ? { acr } : {}),
  };
}

describe('CRM-04 manager tenants HTTP contract', () => {
  let app: INestApplication;
  let createSpy: jest.Mock;

  beforeAll(async () => {
    createSpy = jest.fn(() =>
      Promise.resolve({ id: 't-1', displayName: 'Tenant A' }),
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [ManagerTenantsController],
      providers: [
        MANAGER_PROBLEM_DETAILS_FILTER,
        PlatformAdminGuard,
        {
          provide: IdentityTokenVerifier,
          useValue: {
            verify: jest.fn((token: string) => {
              if (token === 'admin-mfa-token')
                return Promise.resolve(identityFor('admin', 'mfa'));
              if (token === 'admin-plain-token')
                return Promise.resolve(identityFor('admin', 'pwd'));
              if (token === 'member-mfa-token')
                return Promise.resolve(identityFor('member', 'mfa'));
              return Promise.reject(new UnauthorizedException());
            }),
          },
        },
        {
          provide: IdentityContextService,
          useValue: {
            resolveActor: jest.fn((identity: VerifiedIdentity) =>
              (identity as { subject: unknown }).subject === 'admin-subject'
                ? Promise.resolve(adminActor)
                : Promise.resolve(memberActor),
            ),
            resolvePlatformAdmin: jest.fn((actorId: string) =>
              actorId === adminActor.id
                ? Promise.resolve()
                : Promise.reject(new ForbiddenException()),
            ),
          },
        },
        {
          provide: MANAGER_CONFIGURED_KEYCLOAK_ISSUER,
          useValue: configuredIssuer,
        },
        {
          provide: ManagerTenantsService,
          useValue: {
            list: jest.fn((): Promise<TenantListResult> =>
              Promise.resolve({
                items: [
                  {
                    id: '0f2b823f-2eab-4e8a-93f5-23a0e9dc6f92',
                    displayName: 'Tenant A',
                    provisioningState: 'ready',
                    createdAt: new Date(0).toISOString(),
                    updatedAt: new Date(0).toISOString(),
                  },
                ],
                page: 1,
                pageSize: 20,
                total: 1,
              }),
            ),
            getDetail: jest.fn(
              (tenantId: string): Promise<TenantDetailResource> => {
                if (tenantId !== '0f2b823f-2eab-4e8a-93f5-23a0e9dc6f92') {
                  return Promise.reject(
                    new ManagerProblemException({
                      code: 'tenant_not_found',
                      statusCode: HttpStatus.NOT_FOUND,
                      detail: 'Tenant not found.',
                    }),
                  );
                }
                return Promise.resolve({
                  id: tenantId,
                  displayName: 'Tenant A',
                  provisioningState: 'ready',
                  createdAt: new Date(0).toISOString(),
                  updatedAt: new Date(0).toISOString(),
                  provisioning: {
                    stage: 'ready',
                    failureCode: null,
                    attempt: 1,
                  },
                });
              },
            ),
            create: createSpy,
            updateMetadata: jest.fn(),
            startOrRetryProvisioning: jest.fn(),
            assignInitialAdmin: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  function get(path: string, token?: string): request.Test {
    const agent = request(app.getHttpServer() as never).get(path);
    return token ? agent.set('authorization', `Bearer ${token}`) : agent;
  }

  function post(path: string, body?: unknown, token?: string): request.Test {
    const agent = request(app.getHttpServer() as never)
      .post(path)
      .set('content-type', 'application/json');
    if (token) agent.set('authorization', `Bearer ${token}`);
    return typeof body === 'undefined' ? agent : agent.send(body);
  }

  function bodyOf(response: request.Response): Record<string, unknown> {
    return JSON.parse(response.text) as Record<string, unknown>;
  }

  it('requires a bearer credential for every manager route', async () => {
    const response = await get('/api/v1/platform-admin/tenants');
    expect(response.status).toBe(401);
    expect(response.type).toBe('application/problem+json');
    expect(response.body).toMatchObject({ status: 401, code: 'unauthorized' });
    expect(bodyOf(response).requestId).toBeDefined();
  });

  it('rejects unknown credentials as 401 problem details', async () => {
    const response = await get(
      '/api/v1/platform-admin/tenants',
      'not-a-real-token',
    );
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'unauthorized' });
  });

  it('denies tenant members without platform administration', async () => {
    const response = await get(
      '/api/v1/platform-admin/tenants',
      'member-mfa-token',
    );
    expect(response.status).toBe(403);
    expect(response.type).toBe('application/problem+json');
    expect(response.body).toMatchObject({ status: 403, code: 'forbidden' });
    expect(JSON.stringify(response.body)).not.toContain('MFA');
  });

  it('requires MFA even for Control Plane platform admins', async () => {
    const response = await get(
      '/api/v1/platform-admin/tenants',
      'admin-plain-token',
    );
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ status: 403, code: 'forbidden' });
  });

  it('lists tenant metadata with the minimal pagination envelope', async () => {
    const response = await get(
      '/api/v1/platform-admin/tenants?page=1&pageSize=20',
      'admin-mfa-token',
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 1,
    });
    expect((bodyOf(response).items as unknown[])[0]).toMatchObject({
      displayName: 'Tenant A',
      provisioningState: 'ready',
    });
    expect(JSON.stringify(response.body)).not.toContain('database_name');
    expect(JSON.stringify(response.body)).not.toContain('sdb_');
  });

  it('rejects invalid create bodies with safe field errors', async () => {
    const response = await post(
      '/api/v1/platform-admin/tenants',
      { tenant_id: 'other', displayName: '' },
      'admin-mfa-token',
    );
    expect(response.status).toBe(400);
    expect(response.type).toBe('application/problem+json');
    expect(response.body).toMatchObject({
      code: 'validation_failed',
      status: 400,
    });
    expect(bodyOf(response).errors).toEqual([
      { field: 'tenant_id', rule: 'unknown_field' },
      { field: 'displayName', rule: 'invalid_value' },
    ]);
  });

  it('creates a tenant and returns the resource only', async () => {
    const response = await post(
      '/api/v1/platform-admin/tenants',
      { displayName: 'Tenant A' },
      'admin-mfa-token',
    );
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: 't-1', displayName: 'Tenant A' });
    expect(createSpy).toHaveBeenCalledWith(
      { displayName: 'Tenant A' },
      'admin-actor',
    );
  });

  it('renders unknown tenant ids as 404 without leaking details', async () => {
    const response = await get(
      '/api/v1/platform-admin/tenants/11111111-2222-3333-4444-555555555555',
      'admin-mfa-token',
    );
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      status: 404,
      code: 'tenant_not_found',
    });
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });

  it('rejects malformed tenant identifiers before registry lookups', async () => {
    const response = await get(
      '/api/v1/platform-admin/tenants/tenant-a',
      'admin-mfa-token',
    );
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'validation_failed',
      errors: [{ field: 'tenantId', rule: 'invalid_format' }],
    });
  });
});
