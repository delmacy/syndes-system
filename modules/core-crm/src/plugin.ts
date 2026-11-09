import {defineSyndesModule} from "@syndes/core-kernel";
import {crmModule} from "./service.js";
import {CrmHttpModule} from "./nest.module.js";

const asset=(route:string,file:string,contentType:string)=>({
  route,fileUrl:new URL("../public/"+file,import.meta.url).href,contentType,
});
const migration=(id:string)=>({
  id,fileUrl:new URL("../sql/"+id+".sql",import.meta.url).href,
});

/** Explicitly installed module descriptor: API, UI, SQL and policy metadata. */
export const syndesPlugin=defineSyndesModule({
  definition:crmModule,
  apiModule:CrmHttpModule,
  publicOidcClientId:"syndes-crm-ui",
  permissions:[
    {resource:"crm:people",actions:["read","write"]},
    {resource:"crm:organizations",actions:["read","write"]},
    {resource:"crm:relationships",actions:["write"]},
    {resource:"crm:tags",actions:["read","write"]},
    {resource:"crm:notes",actions:["read","write"]},
    {resource:"crm:employees",actions:["read","write"]},
    {resource:"crm:channels",actions:["read","write"]},
  ],
  migrations:[
    migration("001_crm_foundation"),
    migration("002_crm_tags_notes"),
    migration("003_crm_employees_channels"),
  ],
  assets:[
    asset("/crm","crm.html","text/html; charset=utf-8"),
    asset("/crm/app.js","app.js","application/javascript; charset=utf-8"),
    asset("/crm/styles.css","styles.css","text/css; charset=utf-8"),
  ],
});

export {CrmController,CrmHost} from "./crm.controller.js";
