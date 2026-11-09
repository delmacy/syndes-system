/**
 * Public API. Consumers import only from @syndes/core-kernel.
 * Internal files are not supported extension points.
 */
export { CoreKernel } from "./kernel.js";
export { ModuleRegistry } from "./module-registry.js";
export { AccessDeniedError } from "./contracts.js";
export {resolveSelectedOperationalScope} from "./operational-scope.js";
export {accountRolePermits} from "./account-roles.js";
export type {AccountRole,AccountRoleState,AccountCapability,VerifiedTenantMembership,VerifiedAccountGrant,AccountCapabilityRequest} from "./account-roles.js";
export type {RequestedOperationalScope,AuthorizedOperationalScope} from "./operational-scope.js";

export type { TenantDatabase, TrustedTenantDatabaseProvider, Actor, TenancyPort, TenantAccessQuery, AuthorizationPort,
  AuthorizationQuery, AuthorizationRequest } from "./contracts.js";
export type { CoreKernelOptions } from "./kernel.js";
export type { ModuleDefinition, ModuleInitializationContext } from "./module-registry.js";

export {defineSyndesModule} from "./plugin.js";
export type {SyndesPlugin} from "./plugin.js";
