import {defineSyndesModule,type ModuleDefinition} from "@syndes/core-kernel";
import {WhatsAppHttpModule} from "./http.js";
import {WhatsAppInboundHttpModule} from "./inbound-http.js";
import {Module} from "@nestjs/common";
import {WhatsAppDispatchWorker} from "./dispatch-worker.js";
@Module({imports:[WhatsAppHttpModule,WhatsAppInboundHttpModule],providers:[WhatsAppDispatchWorker]})
class WhatsAppApiModule{}
const whatsappModule:ModuleDefinition={id:"whatsapp",version:"0.1.0",dependencies:["platform","crm","inbox"]};
export const syndesPlugin=defineSyndesModule({
 definition:whatsappModule,
 apiModule:WhatsAppApiModule,
 permissions:[{resource:"whatsapp:accounts",actions:["read","write"]}],
 migrations:[{id:"001_whatsapp_accounts",fileUrl:new URL("../sql/001_whatsapp_accounts.sql",import.meta.url).href},{id:"002_whatsapp_inbound",fileUrl:new URL("../sql/002_whatsapp_inbound.sql",import.meta.url).href}],
 assets:[]
});
