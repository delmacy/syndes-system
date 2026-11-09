export type SupportKind="external"|"internal";
export type SupportStatus="new"|"triage"|"in_progress"|"waiting_customer"|"resolved"|"closed";
export type SupportPriority="low"|"normal"|"high"|"critical";
export const INTERNAL_QUEUES=Object.freeze(["it_infra","product","operations","administrative"] as const);
export const EXTERNAL_QUEUE="external_general" as const;
export class SupportInputError extends Error{constructor(message:string){super(message);this.name="SupportInputError";}}
export const validUuid=(v:unknown):v is string=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const validStatus=(v:unknown):v is SupportStatus=>
 typeof v==="string"&&["new","triage","in_progress","waiting_customer","resolved","closed"].includes(v);
export const validPriority=(v:unknown):v is SupportPriority=>
 typeof v==="string"&&["low","normal","high","critical"].includes(v);
export function validateKind(v:unknown):SupportKind{
 if(v!=="internal"&&v!=="external")throw new SupportInputError("Invalid case kind");
 return v;
}
export function validateQueue(kind:SupportKind,v:unknown):string{
 if(typeof v!=="string"||(kind==="external"?v!==EXTERNAL_QUEUE:!(INTERNAL_QUEUES as readonly string[]).includes(v)))
  throw new SupportInputError("Invalid queue for case kind");
 return v;
}
export function requireUuid(v:unknown,name="identifier"):string{
 if(!validUuid(v))throw new SupportInputError("Invalid "+name);
 return v;
}
export function requireObject(value:unknown,fields:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=="object"||Array.isArray(value))throw new SupportInputError("Invalid request body");
 const data=value as Record<string,unknown>;
 if(Object.keys(data).some(k=>!fields.includes(k)))throw new SupportInputError("Unsupported request field");
 return data;
}
function bounded(v:unknown,name:string,max:number):string{
 if(typeof v!=="string"||!v.trim()||v.trim().length>max||/[\u0000-\u001f\u007f]/.test(v))
  throw new SupportInputError("Invalid "+name);
 return v.trim();
}
export const validateNote=(value:unknown)=>bounded(value,"note",5000);
export const validAssignee=(value:unknown)=>bounded(value,"assignee",256);
export function internalRequest(input:unknown){
 const v=requireObject(input,["queue","priority","description"]);
 return {queue:validateQueue("internal",v.queue),priority:priority(v.priority),description:bounded(v.description,"description",5000)};
}
export function externalRequest(input:unknown){
 const v=requireObject(input,["conversationId","priority"]);
 return {conversationId:requireUuid(v.conversationId,"conversation"),priority:priority(v.priority)};
}
export function priority(v:unknown):SupportPriority{
 if(!validPriority(v))throw new SupportInputError("Invalid priority");
 return v;
}
export function parseList(kind:SupportKind,input:Record<string,unknown>){
 validateKind(kind);
 const v=requireObject(input,["queue","priority","status","limit","offset","assigneeId"]);
 const int=(v:unknown,defaultValue:number,max:number)=>{
  if(v===undefined)return defaultValue;
  if(typeof v!=="string"||!/^(0|[1-9][0-9]*)$/.test(v)||Number(v)>max)throw new SupportInputError("Invalid pagination");
  return Number(v);
 };
 const limit=int(v.limit,30,100),offset=int(v.offset,0,100000);
 if(limit<1)throw new SupportInputError("Invalid pagination");
 const out:{kind:SupportKind;queue?:string;priority?:SupportPriority;status?:SupportStatus;assigneeId?:string;limit:number;offset:number}={kind,limit,offset};
 if(v.queue!==undefined)out.queue=validateQueue(kind,v.queue);
 if(v.priority!==undefined)out.priority=priority(v.priority);
 if(v.status!==undefined){
  if(!validStatus(v.status))throw new SupportInputError("Invalid status");
  out.status=v.status;
 }
 if(v.assigneeId!==undefined)out.assigneeId=validAssignee(v.assigneeId);
 return out;
}
const graph:Readonly<Record<SupportStatus,readonly SupportStatus[]>>={
 new:["triage"],
 triage:["in_progress","closed"],
 in_progress:["waiting_customer","resolved"],
 waiting_customer:["in_progress","resolved"],
 resolved:["closed","triage"],
 closed:["triage"]
};
export function allowedPreviousStates(next:unknown):readonly SupportStatus[]{
 if(!validStatus(next))throw new SupportInputError("Invalid target state");
 const result=(Object.keys(graph) as SupportStatus[]).filter(prev=>graph[prev].includes(next));
 return Object.freeze(result);
}
export function stateRequest(input:unknown):SupportStatus{
 const body=requireObject(input,["status"]);
 if(!validStatus(body.status))throw new SupportInputError("Invalid status");
 return body.status;
}
export function assignmentRequest(input:unknown):string{
 return validAssignee(requireObject(input,["assigneeId"]).assigneeId);
}
export function queueRequest(kind:SupportKind,input:unknown):string{
 return validateQueue(kind,requireObject(input,["queue"]).queue);
}
export function noteRequest(input:unknown):string{
 return validateNote(requireObject(input,["body"]).body);
}
