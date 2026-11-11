import type {
  ModuleAccessPort,ModuleAccessRequest,TenantModuleLifecyclePort,TenantModuleState,
} from "@syndes/core-kernel";
import {tenantUUID} from "./adapters.js";

/** AK-10.04 candidate: only new CoreKernel.executeModule call sites
 * can use this adapter; legacy CoreKernel.execute routes are NOT gated yet.
 *
 * Runtime trusts an approved release + authenticated installer attestation
 * stored in the Control Plane. A separate AK-30 reconciler must monitor
 * physical tenant ledger drift; this port cannot read tenant DB directly.
 */
export class PgEffectiveModuleAccess implements ModuleAccessPort {
  constructor(private readonly lifecycle:TenantModuleLifecyclePort) {}

  async canExecuteModule(query:ModuleAccessRequest):Promise<boolean>{
    if(!query||!query.actor||
       !["user","service"].includes(query.actor.kind)||
       typeof query.actor.id!=="string"||!query.actor.id.trim()||
       !tenantUUID(query.tenantId)||
       typeof query.moduleId!=="string"||
       !/^[a-z][a-z0-9_]*$/.test(query.moduleId))return false;
    try{
      // PgModuleLifecycle resolves only active tenants and approved releases
      // that exactly match trusted build schema, version and dependency graph.
      const states=await this.lifecycle.listModuleStates(query.tenantId);
      const map=new Map<string,TenantModuleState>();
      for(const state of states){
        if(!state||map.has(state.moduleId))return false;
        map.set(state.moduleId,state);
      }
      const visiting=new Set<string>(),ok=new Set<string>();
      const granted=(id:string):boolean=>{
        if(ok.has(id))return true;
        if(visiting.has(id))return false;
        const state=map.get(id);
        if(!state||state.moduleId!==id||
           !/^[a-z][a-z0-9_]*$/.test(id)||
           !/^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$/.test(state.version)||
           typeof state.schema!=="string"||!/^[a-z][a-z0-9_]*$/.test(state.schema)||
           state.entitlementState!=="granted"||state.entitled!==true||
           state.installState!=="enabled"||
           state.targetVersion!==state.version||
           state.installedVersion!==state.version||
           state.hasVerificationMetadata!==true||
           !Array.isArray(state.dependencies)||
           state.dependencies.some(dep=>!dep||dep===id)||
           new Set(state.dependencies).size!==state.dependencies.length)return false;
        visiting.add(id);
        if(!state.dependencies.every(dep=>typeof dep==="string"&&granted(dep)))return false;
        visiting.delete(id);
        ok.add(id);
        return true;
      };
      return granted(query.moduleId);
    }catch{
      // A Control DB outage, schema mismatch or malformed snapshot denies.
      return false;
    }
  }
}
