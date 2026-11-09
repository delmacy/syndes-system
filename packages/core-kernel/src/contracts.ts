/** The framework never trusts a tenant identifier merely because a request contains it. */
export type Actor = Readonly<{ id: string; kind: "user" | "service" }>;

export type TenantAccessQuery = Readonly<{
  actor: Actor;
  tenantId: string;
}>;

export type AuthorizationQuery = Readonly<{
  actor: Actor;
  tenantId: string;
  action: string;
  resource: string;
}>;

/** Implement with a verified membership lookup in the application host. */
export interface TenancyPort {
  canAccessTenant(query: TenantAccessQuery): Promise<boolean>;
}

/** Implement with OpenFGA or another independently tested policy engine. */
export interface AuthorizationPort {
  canAccess(query: AuthorizationQuery): Promise<boolean>;
}

/**
 * Only the host may produce an actor after authentication. Neither this
 * contract nor an external module accepts database names from user input.
 */
export interface AuthorizationRequest extends AuthorizationQuery {}

export class AccessDeniedError extends Error {
  constructor() {
    super("Access denied");
    this.name = "AccessDeniedError";
  }
}
