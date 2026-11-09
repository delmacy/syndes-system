import type {Actor,CoreKernel} from "@syndes/core-kernel";
export interface InboxHostRuntime{
 readonly kernel:CoreKernel;
 readonly verifier:{verify(header:string|undefined):Promise<Actor>};
}
export const CORE_RUNTIME="SYNDES_CORE_API";
export const TENANT_DATABASES="SYNDES_TENANT_DB";
