/**
 * UC-SIGNUP-01C: operator-only composition of existing first-tenant adapters.
 *
 * Deliberately not a Nest provider, route, manager action or CLI with mutable
 * tenant/DB/realm inputs. The invoking trusted operator supplies distinct
 * role-scoped Control pools and prevalidated external provider clients.
 * A NEW per-request composition is created for every call: no pool or
 * provisioner state may cross founder/tenant boundaries.
 */
import {AccessDeniedError} from "@syndes/core-kernel";
import type {Pool} from "pg";
import {
 PgSignupReservationStore,type SignupReservation,type SignupReservationInput,
} from "./signup-control-intents.js";
import {FirstTenantSignupSaga,type FirstTenantInstallPort,
 type FirstTenantKeycloakPort,type FirstTenantFgaPort}
 from "./signup-first-tenant-saga.js";
import {PgFirstTenantSignupLock} from "./signup-request-lock.js";
import {PgSignupProvisionedTenantProvider} from "./signup-provisioned-tenant-provider.js";
import {PgFirstTenantOperatorInstaller} from "./signup-first-tenant-installer.js";
import {PgFirstTenantSignupKeycloakLink} from "./signup-initial-link.js";

type Pools=Readonly<{
 /** SELECT/INSERT intent, reconcile function; NO finalize permission. */
 intents:Pool;
 /** EXECUTE only platform_signup_finalize, NO direct registry UPDATE. */
 finalizer:Pool;
 /** Tenant registry/membership + read-only intent, NO Keycloak or FGA. */
 tenant:Pool;
 /** EXECUTE only initial Keycloak↔Control link function. */
 links:Pool;
 /** Dedicated session, no pool.query advisory-lock shortcut. */
 locks:Pool;
}>;
type Source=ConstructorParameters<typeof PgSignupProvisionedTenantProvider>[2];
type Provisioner=ConstructorParameters<typeof PgFirstTenantOperatorInstaller>[2];
type Dependencies=Readonly<{
 pools:Pools;tenantSource:Source;provisioner:Provisioner;
 keycloak:FirstTenantKeycloakPort;grants:FirstTenantFgaPort;
 realm:string;
 authorizeFounder:(founderId:string)=>Promise<boolean>;
 authorizeOperator:(input:SignupReservationInput)=>Promise<boolean>;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function match(a:SignupReservation,b:SignupReservation):boolean{
 return a.requestId===b.requestId&&a.founderId===b.founderId&&
  a.tenantId===b.tenantId&&a.organizationId===b.organizationId&&
  a.workspaceId===b.workspaceId&&a.keycloakAlias===b.keycloakAlias;
}
export class FirstTenantSignupOperator{
 constructor(private readonly deps:Dependencies){
  const d=deps;
  if(!d||!d.pools||!d.keycloak||!d.grants||
     !d.tenantSource||!d.provisioner||
     typeof d.authorizeFounder!=="function"||
     typeof d.authorizeOperator!=="function"||
     !/^[a-z][a-z0-9_-]{1,80}$/.test(d.realm))
   throw new AccessDeniedError();
 }
 async resume(input:SignupReservationInput):Promise<Readonly<{
  ready:true;tenantId:string;organizationId:string;workspaceId:string;
 }>>{
  if(!input||!UUID.test(input.requestId)||!UUID.test(input.founderId))
   throw new AccessDeniedError();
  const d=this.deps;
  const intents=new PgSignupReservationStore(d.pools.intents,
    d.authorizeFounder,d.pools.finalizer);
  const lock=new PgFirstTenantSignupLock(d.pools.locks);
  const links=new PgFirstTenantSignupKeycloakLink(d.pools.links,d.realm);
  let bound:SignupReservation|undefined;
  let scoped:PgSignupProvisionedTenantProvider|undefined;
  let installer:PgFirstTenantOperatorInstaller|undefined;
  const bind=(intent:SignupReservation):PgFirstTenantOperatorInstaller=>{
   if(!intent||intent.requestId!==input.requestId.toLowerCase()||
      intent.founderId!==input.founderId.toLowerCase())
    throw new AccessDeniedError();
   if(bound&&!match(bound,intent))throw new AccessDeniedError();
   if(!installer){
    bound=intent;
    scoped=new PgSignupProvisionedTenantProvider(
     intent,d.pools.tenant,d.tenantSource);
    installer=new PgFirstTenantOperatorInstaller(
     d.pools.tenant,scoped,d.provisioner);
   }
   return installer;
  };
  const install:FirstTenantInstallPort={
   ensureDatabase:async i=>bind(i).ensureDatabase(i),
   verifyDatabase:async i=>bind(i).verifyDatabase(i),
   ensureDefaultContext:async i=>bind(i).ensureDefaultContext(i),
   verifyDefaultContext:async i=>bind(i).verifyDefaultContext(i),
   verifyActive:async i=>bind(i).verifyActive(i),
  };
  const saga=new FirstTenantSignupSaga({
   authorizeOperator:d.authorizeOperator,
   withRequestLock:<T>(requestId:string,
    work:(assertHeld:()=>Promise<void>)=>Promise<T>)=>
     lock.withRequestLock(requestId,work),
   intents,installer:install,keycloak:d.keycloak,links,grants:d.grants,
  });
  try{return await saga.resume(input)}
  finally{if(scoped)await scoped.close()}
 }
}
