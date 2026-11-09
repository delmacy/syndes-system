import type {Actor,CoreKernel} from "@syndes/core-kernel";
import type {TrustedTenantDatabaseProvider} from "./contracts.js";

/** These trusted ports are injected by the Core Host. Modules cannot select
 * database credentials or substitute a client-controlled tenant resolver. */
export interface CrmHostRuntime {
  readonly kernel:CoreKernel;
  readonly verifier:{verify(header:string|undefined):Promise<Actor>};
}
export const CORE_RUNTIME="SYNDES_CORE_API";
export const TENANT_DATABASES="SYNDES_TENANT_DB";
export type {TrustedTenantDatabaseProvider};
