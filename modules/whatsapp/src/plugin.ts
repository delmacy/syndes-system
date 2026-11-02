import {defineSyndesModule,type ModuleDefinition} from "@syndes/core-kernel";
import {WhatsAppHttpModule} from "./http.js";
const whatsappModule:ModuleDefinition={id:"whatsapp",version:"0.1.0",dependencies:["platform","crm","inbox"]};
export const syndesPlugin=defineSyndesModule({
 definition:whatsappModule,
 apiModule:WhatsAppHttpModule,
 permissions:[{resource:"whatsapp:accounts",actions:["read","write"]}],
 migrations:[{id:"001_whatsapp_accounts",fileUrl:new URL("../sql/001_whatsapp_accounts.sql",import.meta.url).href}],
 assets:[]
});
