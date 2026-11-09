import {defineSyndesModule,type ModuleDefinition} from "@syndes/core-kernel";
import {OrganizationHttpModule} from "./nest.module.js";

export const organizationsModule:ModuleDefinition=Object.freeze({
  id:"organizations",version:"0.1.0",dependencies:["platform"],
});
export const syndesPlugin=defineSyndesModule({
  definition:organizationsModule,
  apiModule:OrganizationHttpModule,
  permissions:[
    {resource:"organizations:directory",actions:["read"]},
    {resource:"organizations:bootstrap",actions:["write"]},
    {resource:"organizations:units",actions:["read","write"]},
    {resource:"organizations:workspaces",actions:["write"]},
  ],
  migrations:[{
    id:"001_account_hierarchy",
    fileUrl:new URL("../sql/001_account_hierarchy.sql",import.meta.url).href,
  },{
    id:"002_legacy_single_context_gate",
    fileUrl:new URL("../sql/002_legacy_single_context_gate.sql",import.meta.url).href,
  },{
    id:"003_legacy_ownership",
    fileUrl:new URL("../sql/003_legacy_ownership.sql",import.meta.url).href,
  },{
    id:"004_whatsapp_route_owner_guard",
    fileUrl:new URL("../sql/004_whatsapp_route_owner_guard.sql",import.meta.url).href,
  },{
    id:"005_scoped_relationship_integrity",
    fileUrl:new URL("../sql/005_scoped_relationship_integrity.sql",import.meta.url).href,
  },{
    id:"006_context_creation_audit",
    fileUrl:new URL("../sql/006_context_creation_audit.sql",import.meta.url).href,
  }],
  assets:[],
});
