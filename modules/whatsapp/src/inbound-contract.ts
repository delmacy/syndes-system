export type IncomingWhatsAppMessage={
 accountId:string;externalMessageId:string;senderExternalId:string;senderPhone?:string;body:string;occurredAt:string;
 chatExternalId?:string;fromMe?:boolean;isGroup?:boolean;
 source?:"live"|"history";chatName?:string;
};
export type IncomingWhatsAppChat={
 accountId:string;chatExternalId:string;isGroup:boolean;name?:string;
 unreadCount?:number;archived?:boolean;occurredAt?:string;
};
export type IncomingWhatsAppContact={accountId:string;contactExternalId:string;name:string};
export type IncomingWhatsAppContactEnvelope={
 version:string;type:"whatsapp.contact.name";tenantId:string;accountId:string;contact:IncomingWhatsAppContact;
};
export type IncomingWhatsAppChatEnvelope={
 version:string;type:"whatsapp.chat.snapshot";tenantId:string;accountId:string;chat:IncomingWhatsAppChat;
};
export type IncomingWhatsAppEnvelope={
 version:string;type:"whatsapp.message.received";tenantId:string;accountId:string;message:IncomingWhatsAppMessage;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeJID=(s:unknown)=>typeof s==="string"&&s.length>3&&s.length<=256&&/^[a-zA-Z0-9._:-]+@(s\.whatsapp\.net|lid|g\.us)$/.test(s);
export function validContactEnvelope(tenantId:string,value:unknown):value is IncomingWhatsAppContactEnvelope{
 if(!value||typeof value!=="object")return false;
 const e=value as Partial<IncomingWhatsAppContactEnvelope>,c=e.contact;
 return e.version==="1"&&e.type==="whatsapp.contact.name"&&e.tenantId===tenantId&&uuid.test(tenantId)&&
 uuid.test(String(e.accountId))&&!!c&&c.accountId===e.accountId&&safeJID(c.contactExternalId)&&
 !c.contactExternalId.endsWith("@g.us")&&
 typeof c.name==="string"&&c.name.trim().length>0&&c.name.length<=160;
}
export function validChatEnvelope(tenantId:string,value:unknown):value is IncomingWhatsAppChatEnvelope{
 if(!value||typeof value!=="object")return false;
 const e=value as Partial<IncomingWhatsAppChatEnvelope>,c=e.chat;
 return e.version==="1"&&e.type==="whatsapp.chat.snapshot"&&e.tenantId===tenantId&&uuid.test(tenantId)&&
 uuid.test(String(e.accountId))&&!!c&&c.accountId===e.accountId&&safeJID(c.chatExternalId)&&
 typeof c.isGroup==="boolean"&&c.isGroup===c.chatExternalId.endsWith("@g.us")&&
 (c.name===undefined||(typeof c.name==="string"&&c.name.length<=160))&&
 (c.unreadCount===undefined||(Number.isInteger(c.unreadCount)&&c.unreadCount>=0&&c.unreadCount<=100000))&&
 (c.archived===undefined||typeof c.archived==="boolean")&&
 (c.occurredAt===undefined||(Number.isFinite(Date.parse(c.occurredAt))));
}
export function validIncomingEnvelope(tenantId:string,value:unknown):value is IncomingWhatsAppEnvelope{
 if(!value||typeof value!=="object")return false;
 const e=value as Partial<IncomingWhatsAppEnvelope>,m=e.message;
 return e.version==="1"&&e.type==="whatsapp.message.received"&&e.tenantId===tenantId&&
 uuid.test(tenantId)&&typeof e.accountId==="string"&&uuid.test(e.accountId)&&!!m&&
 m.accountId===e.accountId&&typeof m.externalMessageId==="string"&&m.externalMessageId.length>0&&m.externalMessageId.length<=256&&
 safeJID(m.senderExternalId)&&
 (m.chatExternalId===undefined||safeJID(m.chatExternalId))&&
 (m.isGroup===undefined||typeof m.isGroup==="boolean")&&
 (m.fromMe===undefined||typeof m.fromMe==="boolean")&&
 (m.source===undefined||m.source==="live"||m.source==="history")&&
 (m.chatName===undefined||(typeof m.chatName==="string"&&m.chatName.length<=160))&&
 (m.chatExternalId===undefined||m.isGroup===undefined||m.isGroup===m.chatExternalId.endsWith("@g.us"))&&
(m.senderPhone===undefined||(typeof m.senderPhone==="string"&&/^\+[1-9][0-9]{9,14}$/.test(m.senderPhone)))&&
 typeof m.body==="string"&&m.body.length>0&&m.body.length<=10000&&
 typeof m.occurredAt==="string"&&Number.isFinite(Date.parse(m.occurredAt));
}
