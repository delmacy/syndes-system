import type {TenantDatabase} from "./contracts.js";
import {TenantDatabaseMismatchError} from "./contracts.js";
import {isUuid} from "./validation.js";

/**
 * Explicit SQL fragments for the owner-scoped repository path.
 * Markers are authored by the server, never by callers. The organization UUID
 * is always bound as an extra PostgreSQL parameter, not interpolated into SQL.
 * Old unscoped repository callers remain supported ONLY while the platform
 * single-organization UNIQUE indexes still protect the tenant database.
 */
export function crmOwnerQuery(
  db:TenantDatabase,organizationId:string|undefined,
  sql:string,values:readonly unknown[],
):ReturnType<TenantDatabase["query"]>{
  if(process.env.SYNDES_MULTI_ORG_ENABLED==="true"&&organizationId===undefined)
    throw new Error("Unscoped CRM query prohibited in multi-organization mode");
  if(organizationId!==undefined&&!isUuid(organizationId))
    throw new TenantDatabaseMismatchError();
  const marker=/\/\*ORG:([\s\S]*?)\*\//g;
  let markers=0;
  let boundOwner=0;
  const ownerParameter="$"+String(values.length+1)+"::uuid";
  const statement=sql.replace(marker,(_full:string,fragment:string)=>{
    markers++;
    if(fragment.includes("@@ORG@@"))boundOwner++;
    return organizationId===undefined?"":fragment.replaceAll("@@ORG@@",ownerParameter);
  });
  if(organizationId!==undefined&&(markers===0||boundOwner===0))
    throw new Error("Scoped CRM SQL is missing an organization predicate");
  return db.query(statement,organizationId===undefined?values:[...values,organizationId]);
}
