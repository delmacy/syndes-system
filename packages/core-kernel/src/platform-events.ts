/** Typed v1 platform contracts: identifiers only, no message bodies or customer PII. */
export const platformEventTypes=Object.freeze([
 "crm.person.created.v1",
 "whatsapp.message.received.v1",
 "inbox.participant.observed.v1",
 "crm.person.resolved.v1",
 "crm.person.review_required.v1",
] as const);
export type PlatformEventType=typeof platformEventTypes[number];
export type EventProducer="crm"|"whatsapp"|"inbox"|"organizations";
export type PublishPlatformEvent=Readonly<{
 tenantId:string;organizationId:string;workspaceId?:string|null;
 type:PlatformEventType;producer:EventProducer;
 aggregateType:string;aggregateId:string;idempotencyKey:string;
 correlationId:string;causationId?:string|null;
 payload:Readonly<Record<string,unknown>>;
}>;
export type StoredPlatformEvent=PublishPlatformEvent & Readonly<{
 eventId:string;createdAt:Date;
}>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const expected:Readonly<Record<PlatformEventType,Readonly<{producer:EventProducer;keys:readonly string[]}>>>={
 "crm.person.created.v1":{producer:"crm",keys:["personId"]},
 "whatsapp.message.received.v1":{producer:"whatsapp",keys:["inboundEventId","accountId"]},
 "inbox.participant.observed.v1":{producer:"inbox",keys:["conversationId"]},
 "crm.person.resolved.v1":{producer:"crm",keys:["conversationId","personId"]},
 "crm.person.review_required.v1":{producer:"crm",keys:["conversationId","reason"]},
};
export function validatePlatformEvent(input:PublishPlatformEvent):void{
 if(!input||!platformEventTypes.includes(input.type)||!UUID.test(input.tenantId)||
    !UUID.test(input.organizationId)||(input.workspaceId!=null&&!UUID.test(input.workspaceId))||
    !UUID.test(input.aggregateId)||!UUID.test(input.correlationId)||
    (input.causationId!=null&&!UUID.test(input.causationId))||
    !/^[a-z][a-z0-9_]*$/.test(input.aggregateType)||
    !/^[a-z0-9][a-z0-9_.:-]{0,127}$/.test(input.idempotencyKey))
   throw new Error("Invalid platform event identity");
 const spec=expected[input.type];
 if(input.producer!==spec.producer)throw new Error("Event producer mismatch");
 if(!input.payload||Array.isArray(input.payload)||typeof input.payload!=="object"||
   Object.keys(input.payload).length!==spec.keys.length||
   !spec.keys.every(key=>Object.hasOwn(input.payload,key)))
   throw new Error("Invalid platform event payload shape");
 for(const key of spec.keys){
  const value=input.payload[key];
  if(key==="reason"){
   if(value!=="ambiguous"&&value!=="missing_identity"&&value!=="conflicting_link")
     throw new Error("Invalid identity review reason");
  }else if(typeof value!=="string"||!UUID.test(value)){
   throw new Error("Invalid platform event reference");
  }
 }
 if(JSON.stringify(input.payload).length>2048)throw new Error("Event payload exceeds limit");
}
