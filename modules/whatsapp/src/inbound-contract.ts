export type IncomingWhatsAppMessage={
 accountId:string;externalMessageId:string;senderExternalId:string;senderPhone?:string;body:string;occurredAt:string;
};
export type IncomingWhatsAppEnvelope={
 version:string;type:string;tenantId:string;accountId:string;message:IncomingWhatsAppMessage;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validIncomingEnvelope(tenantId:string,value:unknown):value is IncomingWhatsAppEnvelope{
 if(!value||typeof value!=="object")return false;
 const e=value as Partial<IncomingWhatsAppEnvelope>,m=e.message;
 return e.version==="1"&&e.type==="whatsapp.message.received"&&e.tenantId===tenantId&&
 uuid.test(tenantId)&&typeof e.accountId==="string"&&uuid.test(e.accountId)&&!!m&&
 m.accountId===e.accountId&&typeof m.externalMessageId==="string"&&m.externalMessageId.length>0&&m.externalMessageId.length<=256&&
 typeof m.senderExternalId==="string"&&m.senderExternalId.length>0&&m.senderExternalId.length<=256&&
(m.senderPhone===undefined||(typeof m.senderPhone==="string"&&/^\+[1-9][0-9]{9,14}$/.test(m.senderPhone)))&&
 typeof m.body==="string"&&m.body.length>0&&m.body.length<=10000&&
 typeof m.occurredAt==="string"&&Number.isFinite(Date.parse(m.occurredAt));
}
