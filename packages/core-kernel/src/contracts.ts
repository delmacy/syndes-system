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

/** Host-selected database handle. A client must never supply its DSN or role. */
export type TenantDatabase = Readonly<{
  tenantId:string;
  query(sql:string,values:readonly unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;
}>;

export interface TrustedTenantDatabaseProvider {
  resolve(tenantId:string):Promise<TenantDatabase>;
}

/** Pinned one-connection SQL lease. Lifecycle is controlled by the host. */
export const PINNED_TENANT_TRANSACTION:unique symbol=Symbol("syndes.tenant.transaction");
export type TenantTransaction=TenantDatabase & Readonly<{[PINNED_TENANT_TRANSACTION]:true}>;
/** Optional capability: existing query-only providers remain supported, but
 * publication and consumer effects must require this stronger port. */
export interface TrustedTenantTransactionProvider extends TrustedTenantDatabaseProvider {
 withTransaction<T>(tenantId:string,work:(tx:TenantTransaction)=>Promise<T>):Promise<T>;
}
