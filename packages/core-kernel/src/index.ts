/**
 * Public API. Consumers import only from @syndes/core-kernel.
 * Internal files are not supported extension points.
 */
export { CoreKernel } from "./kernel.js";
export { ModuleRegistry } from "./module-registry.js";
export { AccessDeniedError } from "./contracts.js";

export type { Actor, TenancyPort, TenantAccessQuery, AuthorizationPort,
  AuthorizationQuery, AuthorizationRequest } from "./contracts.js";
export type { CoreKernelOptions } from "./kernel.js";
export type { ModuleDefinition, ModuleInitializationContext } from "./module-registry.js";
