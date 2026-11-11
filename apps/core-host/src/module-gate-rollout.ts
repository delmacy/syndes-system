/**
 * Rollout switch is owned by the trusted Core Host, not by the HTTP caller.
 * Legacy remains the deliberate default until Control DB migrations, operator
 * grants, tenant enrollment and restore rehearsals are completed.
 */
export type ModuleGateMode = "legacy" | "enforce";
export type CrmModuleGateMode = ModuleGateMode;
export type InboxModuleGateMode = ModuleGateMode;

function checkedGateMode(name:string,value:string|undefined):ModuleGateMode {
  if(value===undefined||value==="legacy")return "legacy";
  if(value==="enforce")return "enforce";
  throw new Error("Invalid "+name+" mode");
}

export function crmModuleGateMode(value: string | undefined): CrmModuleGateMode {
  return checkedGateMode("SYNDES_CRM_MODULE_GATE",value);
}
export function inboxModuleGateMode(value: string | undefined): InboxModuleGateMode {
  return checkedGateMode("SYNDES_INBOX_MODULE_GATE",value);
}
