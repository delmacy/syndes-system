export {inboxModule,InboxService} from "./service.js";
export {PgInboxRepository,PgInboxRepositoryFactory,InboxConflictError} from "./postgres.js";
export {InboxValidationError,InboxTenantMismatchError} from "./contracts.js";
export type {InboxContext,Conversation,Message,InboxRepository,ConversationStatus,
 HandoffMode,CreateConversation,InboxMetrics} from "./contracts.js";
export {SimulatedChannelAdapter} from "./channels.js";
export type {InboundChannelEvent,InboundChannelAdapter} from "./channels.js";

export {InboxChangeBus} from "./realtime.js";
export {InboxWhatsAppReceivedConsumer} from "./whatsapp-event-consumer.js";
export {InboxCrmPersonResolvedConsumer} from "./crm-link-event-consumer.js";
export type {InboxWhatsAppMessageReader,InboxWhatsAppRouteCommands} from "./whatsapp-event-consumer.js";
export type {InboxCrmLinkValidator} from "./crm-link-event-consumer.js";
export {InboxDefaultContextGuard} from "./context-guard.js";
export {inboxScopedQuery} from "./scope-query.js";
