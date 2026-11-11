import {defineSyndesModule} from "@syndes/core-kernel";
import {serviceManagementModule} from "./service.js";
import {ServiceManagementHttpModule} from "./controller.js";

export const syndesPlugin=defineSyndesModule({
 definition:serviceManagementModule,
 apiModule:ServiceManagementHttpModule,
 permissions:[
  {resource:"service-management:funnels",actions:["read","write"]},
  {resource:"service-management:attendances",actions:["read","write"]},
  {resource:"service-management:teams",actions:["read","write"]},
 ],
 migrations:[{id:"001_service_funnels",
  fileUrl:new URL("../sql/001_service_funnels.sql",import.meta.url).href},
  {id:"002_service_team_transfer",
   fileUrl:new URL("../sql/002_service_team_transfer.sql",import.meta.url).href},
  {id:"003_service_conversation_inspector",
   fileUrl:new URL("../sql/003_service_conversation_inspector.sql",import.meta.url).href}],
 assets:[],
});
export {ServiceManagementHost,ServiceManagementController} from "./controller.js";
