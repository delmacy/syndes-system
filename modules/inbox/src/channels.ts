import type {InboxContext,Message} from "./contracts.js";
import {InboxValidationError} from "./contracts.js";
import type {InboxService} from "./service.js";

/** Provider-independent wire envelope; no whatsmeow, QR or channel token in the Inbox domain. */
export type InboundChannelEvent=Readonly<{
 channel:string;
 conversationId:string;
 externalMessageId:string;
 body:string;
}>;
export interface InboundChannelAdapter{
 readonly channel:string;
 receive(context:InboxContext,event:InboundChannelEvent):Promise<Message|null>;
}
/** Dev-only adapter: requires an authenticated, tenant-authorized actor. */
export class SimulatedChannelAdapter implements InboundChannelAdapter{
 readonly channel="simulation";
 constructor(private readonly inbox:InboxService){}
 receive(context:InboxContext,event:InboundChannelEvent):Promise<Message|null>{
  if(!event||event.channel!==this.channel)throw new InboxValidationError("Unsupported channel");
  return this.inbox.simulate(context,event.conversationId,event.body,event.externalMessageId);
 }
}
