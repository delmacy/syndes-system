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
  ],
  migrations:[{
    id:"001_account_hierarchy",
    fileUrl:new URL("../sql/001_account_hierarchy.sql",import.meta.url).href,
  }],
  assets:[],
});
