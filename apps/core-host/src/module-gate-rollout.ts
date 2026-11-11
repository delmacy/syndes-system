/**
 * Rollout switch is owned by the trusted Core Host, not by the HTTP caller.
 * Legacy remains the deliberate default until Control DB migrations, operator
 * grants, tenant enrollment and restore rehearsals are completed.
 */
export type CrmModuleGateMode = "legacy" | "enforce";
export function crmModuleGateMode(value: string | undefined): CrmModuleGateMode {
  if (value === undefined || value === "legacy") return "legacy";
  if (value === "enforce") return "enforce";
  throw new Error("Invalid SYNDES_CRM_MODULE_GATE mode");
}
