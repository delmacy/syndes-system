import type {ModuleDefinition} from "@syndes/core-kernel";
import {crmModule} from "@syndes/core-crm";

/** Composition belongs to Core Host, never to the reusable framework kernel.
 * Domain endpoints remain disabled until a trusted per-tenant DB adapter is wired. */
export const registeredModules:readonly ModuleDefinition[]=Object.freeze([
  {id:"platform",version:"0.1.0"},
  crmModule,
]);
