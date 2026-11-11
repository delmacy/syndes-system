import type {
 ModuleAccessPort,TrustedTenantTransactionProvider,
} from "@syndes/core-kernel";
import {TenantEventPublisher} from "./platform-event-publisher.js";
import {TenantEventDispatcher,type EventSubscription} from "./platform-event-dispatcher.js";
import {
 TenantEventWorkerAdmission,PgEventWorkerScope,type TrustedServiceEventGrant,
} from "./platform-event-worker-admission.js";
import {
 WhatsAppTransactionalInboundBridge,PostgresWhatsAppInboundMessageReader,
} from "@syndes/whatsapp/event-bridge";
import {PgWhatsAppConversationRouteCommands} from "@syndes/whatsapp/event-route-commands";
import {PgWhatsAppConversationIdentityReader} from "@syndes/whatsapp/event-identity-reader";
import {
 InboxWhatsAppReceivedConsumer,InboxCrmPersonResolvedConsumer,
} from "@syndes/core-inbox";
import {
 CrmWhatsAppIdentityPolicy,CrmWhatsAppIdentityConsumer,
} from "@syndes/core-crm";

/** Construction only, not startup. No route, tenant enumeration, scheduler,
 * Nest provider or HTTP ingress is activated by this factory. */
export function composeTenantEventWorker(deps:Readonly<{
 databases:TrustedTenantTransactionProvider;
 modules:ModuleAccessPort;
 serviceGrants:TrustedServiceEventGrant;
 principalId:string;
}>){
 const publisher=new TenantEventPublisher();
 const routes=new PgWhatsAppConversationRouteCommands();
 const identity=new CrmWhatsAppIdentityPolicy(new PgWhatsAppConversationIdentityReader());
 const inbox=new InboxWhatsAppReceivedConsumer(
  new PostgresWhatsAppInboundMessageReader(),routes,publisher);
 const crm=new CrmWhatsAppIdentityConsumer(identity,publisher);
 const linker=new InboxCrmPersonResolvedConsumer(identity);
 const subscriptions:readonly EventSubscription[]=[
  {
   id:"inbox.message-received-v2",moduleId:"inbox",
   types:["whatsapp.message.received.v2"],
   handle:(tx,event)=>inbox.handle(tx,event),
  },
  {
   id:"crm.resolve-person",moduleId:"crm",
   types:["inbox.participant.observed.v1"],
   handle:(tx,event)=>crm.handle(tx,event),
  },
  {
   id:"inbox.crm-person-link",moduleId:"inbox",
   types:["crm.person.resolved.v1"],
   handle:(tx,event)=>linker.handle(tx,event),
  },
 ];
 const admission=new TenantEventWorkerAdmission(
  deps.modules,new PgEventWorkerScope(deps.databases),
  deps.serviceGrants,deps.principalId);
 const dispatcher=new TenantEventDispatcher(
  deps.databases,subscriptions,admission,deps.principalId);
 return Object.freeze({
  bridge:new WhatsAppTransactionalInboundBridge(deps.databases,publisher),
  dispatcher,
  subscriberIds:Object.freeze(subscriptions.map(x=>x.id)),
 });
}
