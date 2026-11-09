import type {TenantDatabase} from "./contracts.js";
import {InboxTenantMismatchError} from "./contracts.js";
import {id} from "./validation.js";

export type InboxDataScope=Readonly<{organizationId:string;workspaceId:string}>;

/** Trusted static SQL fragments only; bind org and workspace after normal
 * parameters. Legacy direct provider calls without scope remain supported
 * ONLY while the DB single-context migration 002 is enforced.
 */
export function inboxScopedQuery(db:TenantDatabase,scope:InboxDataScope|undefined,
 sql:string,values:readonly unknown[]):ReturnType<TenantDatabase["query"]>{
 if(!scope&&process.env.SYNDES_MULTI_ORG_ENABLED==="true")
  throw new InboxTenantMismatchError();
 if(scope){
  try{id(scope.organizationId,"organization");id(scope.workspaceId,"workspace");}
  catch{throw new InboxTenantMismatchError();}
 }
 const re=/\/\*SCOPE:([\s\S]*?)\*\//g;
 const org="$"+(values.length+1)+"::uuid",ws="$"+(values.length+2)+"::uuid";
 let fragments=0,hasOrg=false,hasWs=false;
 const query=sql.replace(re,(_whole:string,fragment:string)=>{
  fragments++;
  if(fragment.includes("@@ORG@@"))hasOrg=true;
  if(fragment.includes("@@WS@@"))hasWs=true;
  return scope?fragment.replaceAll("@@ORG@@",org).replaceAll("@@WS@@",ws):"";
 });
 if(scope&&(!fragments||!hasOrg||!hasWs))
  throw new Error("Scoped Inbox SQL lacks organization/workspace constraints");
 return db.query(query,scope?[...values,scope.organizationId,scope.workspaceId]:values);
}
