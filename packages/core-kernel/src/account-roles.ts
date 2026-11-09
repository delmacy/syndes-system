import type {Actor} from "./contracts.js";

/**
 * DC-2 / issue #49: account-level administrative entitlement ONLY.
 *
 * This never authorizes access to operational resources (CRM, Inbox, Support,
 * WhatsApp, HR); those still need tenant + org + workspace memberships and
 * independent per-action OpenFGA decisions.
 *
 * Inputs MUST be retrieved by a trusted server from control-plane records,
 * not accepted directly from browser/body/headers. This predicate alone is
 * NOT final authorization; the calling API must also enforce JWT and OpenFGA.
 */
export type AccountRole="owner"|"admin";
export type AccountRoleState="active"|"revoked";
export type AccountCapability=
 | "account.profile.read"
 | "account.profile.manage"
 | "account.members.read"
 | "account.members.manage"
 | "account.roles.manage"
 | "account.billing.read";

export type VerifiedTenantMembership=Readonly<{
 tenantId:string;
 principalId:string;
 state:AccountRoleState;
}>;

export type VerifiedAccountGrant=Readonly<{
 tenantId:string;
 principalId:string;
 role:AccountRole;
 state:AccountRoleState;
}>;

export type AccountCapabilityRequest=Readonly<{
 actor:Actor;
 tenantId:string;
 capability:AccountCapability;
 membership:VerifiedTenantMembership|null;
 grant:VerifiedAccountGrant|null;
}>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ownerCapabilities=new Set<AccountCapability>([
 "account.profile.read","account.profile.manage",
 "account.members.read","account.members.manage",
 "account.roles.manage","account.billing.read",
]);
const adminCapabilities=new Set<AccountCapability>([
 "account.profile.read","account.profile.manage",
 "account.members.read","account.members.manage",
]);

/** Returns role eligibility, not permission to bypass any outer security gate. */
export function accountRolePermits(request:AccountCapabilityRequest):boolean{
 if(!request||!request.actor||request.actor.kind!=="user"||
    typeof request.actor.id!=="string"||!request.actor.id||
    typeof request.tenantId!=="string"||!UUID.test(request.tenantId))
  return false;

 const {actor,tenantId,membership,grant,capability}=request;
 if(!membership||!grant||
    membership.state!=="active"||grant.state!=="active"||
    membership.tenantId!==tenantId||grant.tenantId!==tenantId||
    membership.principalId!==actor.id||grant.principalId!==actor.id)
  return false;

 if(grant.role==="owner")return ownerCapabilities.has(capability);
 if(grant.role==="admin")return adminCapabilities.has(capability);
 return false;
}
