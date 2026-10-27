export type TenantRole = 'tenant_admin' | 'tenant_member';
export type CustomerScope = 'cpf' | 'pj' | 'both';

export interface AuthenticatedActor {
  id: string;
  issuer: string;
  subject: string;
  platformAdmin: boolean;
}

export interface TenantContext {
  actorId: string;
  tenantId: string;
  databaseName: string;
  role: TenantRole;
  customerScope: CustomerScope;
}

export interface IdentityClaims {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  azp?: unknown;
  exp?: unknown;
  nbf?: unknown;
  acr?: unknown;
}

export interface IdentityRequestContext {
  actor: AuthenticatedActor;
  tenant?: TenantContext;
}
