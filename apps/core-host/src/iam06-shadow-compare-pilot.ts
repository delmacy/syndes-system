/**
 * IAM-06 candidate: isolated, non-blocking diagnostic comparison.
 *
 * NOT imported by main.ts. Never a grant authority, replacement for OpenFGA,
 * or a substitute for IAM-05 signed identity + live membership + SQL ownership.
 * Only two already-declared legacy capabilities have a known coarse FGA mapping;
 * that mapping is NOT proof of fine-grained authorization equivalence.
 */
import type {AuthorizationPort} from "@syndes/core-kernel";
import type {ResolvedIamPilotContext} from "./iam-organization-context-pilot.js";
import {
  pilotResourceName,
  type KeycloakPilotCapability,type TrustedKeycloakPilotContext,
  type KeycloakUmaAuthorizationPilot,
} from "./keycloak-authorization-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const REALM=/^[a-z][a-z0-9_-]{1,80}$/;

/** These legacy FGA grants are coarse. Claim, transfer and funnel operation
 * are PROPOSED and cannot be mapped to coarse read/write as exact equivalence.
 */
const LEGACY=Object.freeze({
  "inbox.conversation.read":Object.freeze({resource:"inbox:conversations",action:"read",moduleId:"inbox",write:false}),
  "inbox.message.send":Object.freeze({resource:"inbox:messages",action:"write",moduleId:"inbox",write:true}),
} as const);

export type ShadowCategory =
  | "legacy_coarse_agree_allow" | "legacy_coarse_agree_deny"
  | "legacy_coarse_fga_allow_uma_deny" | "legacy_coarse_fga_deny_uma_allow"
  | "not_comparable" | "catalog_unmapped" | "shadow_error"
  | "shadow_capacity_skipped" | "fga_error";

/** The sink receives only fixed categories: no subject, JWT, tenant, org,
 * workspace, funnel, resource IDs, bearer, Keycloak response or SQL row.
 */
export interface Iam06ShadowMetrics {
  increment(category:ShadowCategory):void;
}
export type KeycloakPilotResource=Readonly<{
  id:string;name:string;scopeId:string;scopeName:string;
}>;
export interface TrustedPilotResourceCatalog {
  resolve(context:TrustedKeycloakPilotContext,
    capability:KeycloakPilotCapability):Promise<KeycloakPilotResource|null>;
}
type PilotUma=Pick<KeycloakUmaAuthorizationPilot,"check">;

export class Iam06ShadowComparePilot {
  private readonly active=new Set<Promise<void>>();
  private readonly maxPending:number;
  private readonly timeoutMs:number;
  constructor(private readonly deps:Readonly<{
    realm:string;
    fga:AuthorizationPort;
    uma:PilotUma;
    resources:TrustedPilotResourceCatalog;
    metrics:Iam06ShadowMetrics;
    maxPending?:number;
    timeoutMs?:number;
  }>){
    this.maxPending=deps?.maxPending??16;
    this.timeoutMs=deps?.timeoutMs??3500;
    if(!REALM.test(deps?.realm??"")||!deps.fga||!deps.uma||
       !deps.resources||!deps.metrics||
       typeof deps.fga.canAccess!=="function"||typeof deps.uma.check!=="function"||
       typeof deps.resources.resolve!=="function"||typeof deps.metrics.increment!=="function"||
       !Number.isInteger(this.maxPending)||this.maxPending<1||this.maxPending>64||
       !Number.isInteger(this.timeoutMs)||this.timeoutMs<1||this.timeoutMs>5000)
      throw new TypeError("IAM shadow configuration invalid");
  }

  /** Must be called ONLY after OrganizationContextAdmissionPilot.resolve.
   * Caller must also enforce resource ownership and business rules in the
   * same transaction as its effect. Return value is solely the FGA decision.
   * UMA never influences the return value, even if FGA denies or UMA errors.
   */
  async authorize(input:Readonly<{
    context:ResolvedIamPilotContext;
    verifiedAccessToken:string;
  }>):Promise<boolean>{
    const context=input?.context;
    const legacy=context && Object.hasOwn(LEGACY,context.capability)
      ?LEGACY[context.capability as keyof typeof LEGACY] : undefined;
    if(!context||!legacy||!this.validContext(context,legacy.moduleId,legacy.write)||
       !JWT.test(input?.verifiedAccessToken??"")){
      this.count("not_comparable");
      return false;
    }

    // OpenFGA is the exclusive effective decision. No UMA before FGA.
    let allowed:boolean;
    try{
      const result=await this.deps.fga.canAccess({
        actor:context.actor,tenantId:context.tenantId,
        resource:legacy.resource,action:legacy.action,
      });
      if(typeof result!=="boolean")throw new Error("Invalid FGA decision");
      allowed=result;
    }catch{
      this.count("fga_error");
      return false;
    }

    // Never await the Keycloak branch on the caller's authorization path.
    if(this.active.size>=this.maxPending){
      this.count("shadow_capacity_skipped");
      return allowed;
    }
    const scope:TrustedKeycloakPilotContext=Object.freeze({
      tenantId:context.tenantId,organizationId:context.organizationId,
      workspaceId:context.workspaceId,kind:"workspace" as const,
    });
    const capability=context.capability;
    const token=input.verifiedAccessToken;
    const job=Promise.resolve().then(async()=>{
      let timer:ReturnType<typeof setTimeout>|undefined;
      try{
        const timedOut=new Promise<never>((_,reject)=>{
          timer=setTimeout(()=>reject(new Error("Shadow deadline")),this.timeoutMs);
          timer.unref?.();
        });
        const category=await Promise.race([
          this.inspect(scope,capability,token,allowed),timedOut,
        ]);
        this.count(category);
      }catch{
        this.count("shadow_error");
      }finally{
        if(timer)clearTimeout(timer);
      }
    });
    this.active.add(job);
    void job.finally(()=>this.active.delete(job));
    return allowed;
  }

  /** Test-only deterministic observation; NEVER use on an HTTP response path. */
  async drainForTests():Promise<void>{
    await Promise.all([...this.active]);
  }

  private validContext(c:ResolvedIamPilotContext,moduleId:string,write:boolean):boolean{
    if(!Object.isFrozen(c)||!Object.isFrozen(c.actor)||
       c.actor.kind!=="user"||!UUID.test(c.actor.id)||
       c.realm!==this.deps.realm||c.moduleId!==moduleId||
       !UUID.test(c.tenantId)||!UUID.test(c.organizationId)||
       !UUID.test(c.workspaceId)||!UUID.test(c.keycloakOrganizationId)||
       (write&&c.scopeWriteAllowed!==true))return false;
    try{
      return c.resourceName===pilotResourceName({
        tenantId:c.tenantId,organizationId:c.organizationId,
        workspaceId:c.workspaceId,kind:"workspace",
      });
    }catch{return false;}
  }

  private async inspect(scope:TrustedKeycloakPilotContext,
    capability:KeycloakPilotCapability,token:string,
    fgaAllowed:boolean):Promise<ShadowCategory>{
    const mapped=await this.deps.resources.resolve(scope,capability);
    if(!mapped || mapped.name!==pilotResourceName(scope) ||
       mapped.scopeName!==capability||!UUID.test(mapped.id)||
       !UUID.test(mapped.scopeId))return "catalog_unmapped";
    // Caller supplied verified HUMAN access token, not service/admin token.
    const decision=await this.deps.uma.check({
      verifiedAccessToken:token,context:scope,capability,
      keycloakResource:mapped,
    });
    if(typeof decision!=="boolean")throw new Error("Invalid UMA decision");
    if(fgaAllowed&&decision)return "legacy_coarse_agree_allow";
    if(!fgaAllowed&&!decision)return "legacy_coarse_agree_deny";
    return fgaAllowed ? "legacy_coarse_fga_allow_uma_deny":
      "legacy_coarse_fga_deny_uma_allow";
  }
  private count(category:ShadowCategory):void{
    try{this.deps.metrics.increment(category);}catch{/* diagnostic only */}
  }
}
