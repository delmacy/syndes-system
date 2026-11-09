export type SupportKind="internal"|"external";
export type CasePriority="low"|"normal"|"high"|"critical";
export type CaseStatus="new"|"triage"|"in_progress"|"waiting_customer"|"resolved"|"closed";
export const QUEUES:Record<SupportKind,readonly {code:string;label:string}[]>={
 internal:[
  {code:"it_infra",label:"TI / Infraestrutura"},
  {code:"product",label:"Produto"},
  {code:"operations",label:"Operações"},
  {code:"administrative",label:"Administrativo"}
 ],
 external:[{code:"external_general",label:"Atendimento externo"}]
};
export const STATUSES:readonly CaseStatus[]=["new","triage","in_progress","waiting_customer","resolved","closed"];
export const PRIORITIES:readonly CasePriority[]=["low","normal","high","critical"];
export const ALLOWED_NEXT:Record<CaseStatus,readonly CaseStatus[]>={
 new:["triage"],triage:["in_progress","closed"],in_progress:["waiting_customer","resolved"],
 waiting_customer:["in_progress","resolved"],resolved:["closed","triage"],closed:["triage"]
};
export type SupportCase={
 id:string;protocol:string;kind:SupportKind;channel:string;requesterId:string;
 queue:string;assignedTo:string|null;priority:CasePriority;status:CaseStatus;
 crmPersonId:string|null;conversationId:string|null;commercialTenantRef:string|null;
 createdAt:string;updatedAt:string;resolvedAt:string|null;closedAt:string|null;canOperate:boolean;
};
export type CaseEvent={
 id:string;action:string;actorId:string;previousStatus:string|null;nextStatus:string|null;
 body:string|null;recordedAt:string
};
export type InboxConversation={id:string;subject:string;channel:string;crmPersonId:string|null};
export type CaseFilters={queue?:string|undefined;status?:CaseStatus|undefined;priority?:CasePriority|undefined;assigneeId?:string|undefined;limit?:string|undefined;offset?:string|undefined};
export class ApiError extends Error{
 readonly status:number;
 constructor(status:number,message:string){super(message);this.status=status;this.name="ApiError";}
}
export class SupportApi{
 private readonly tenantId:string;
 private readonly bearer:string;
 private readonly onUnauthorized:()=>void;
 constructor(tenantId:string,bearer:string,onUnauthorized:()=>void){
  this.tenantId=tenantId;this.bearer=bearer;this.onUnauthorized=onUnauthorized;
 }
 private async request<T>(url:string,method="GET",body?:object):Promise<T>{
  const response=await fetch("/v1/tenants/"+encodeURIComponent(this.tenantId)+url,{
   method,headers:{
    Authorization:"Bearer "+this.bearer,
    ...(body?{"Content-Type":"application/json"}:{})
   },...(body?{body:JSON.stringify(body)}:{}),cache:"no-store"
  });
  if(response.status===401)this.onUnauthorized();
  if(!response.ok){
   const detail:unknown=await response.json().catch(()=>null);
   const message=(detail as {message?:unknown}|null)?.message;
   throw new ApiError(response.status,response.status===401?"Sessão expirada. Entre novamente.":
    response.status===403?"Você não tem permissão para esta operação.":
    response.status===409?"Já existe um chamado ativo para esta conversa.":
    typeof message==="string"?message:"Operação indisponível ("+response.status+").");
  }
  return await response.json() as T;
 }
 cases(kind:SupportKind,filters:CaseFilters={}){
  const q=new URLSearchParams();
  for(const [key,value] of Object.entries(filters))
   if(value!==undefined&&value!=="")q.set(key,value);
  return this.request<SupportCase[]>("/support/"+kind+"/cases?"+q.toString());
 }
 get(kind:SupportKind,id:string){
  return this.request<SupportCase>("/support/"+kind+"/cases/"+encodeURIComponent(id));
 }
 events(kind:SupportKind,id:string){
  return this.request<CaseEvent[]>("/support/"+kind+"/cases/"+encodeURIComponent(id)+"/events");
 }
 createInternal(queue:string,priority:CasePriority,description:string){
  return this.request<SupportCase>("/support/internal/cases","POST",{queue,priority,description});
 }
 createExternal(conversationId:string,priority:CasePriority){
  return this.request<SupportCase>("/support/external/cases","POST",{conversationId,priority});
 }
 changeStatus(kind:SupportKind,id:string,status:CaseStatus){
  return this.request<SupportCase>("/support/"+kind+"/cases/"+encodeURIComponent(id)+"/status","PATCH",{status});
 }
 assign(kind:SupportKind,id:string,assigneeId:string){
  return this.request<SupportCase>("/support/"+kind+"/cases/"+encodeURIComponent(id)+"/assignment","PATCH",{assigneeId});
 }
 transfer(kind:SupportKind,id:string,queue:string){
  return this.request<SupportCase>("/support/"+kind+"/cases/"+encodeURIComponent(id)+"/queue","PATCH",{queue});
 }
 note(kind:SupportKind,id:string,body:string){
  return this.request<CaseEvent>("/support/"+kind+"/cases/"+encodeURIComponent(id)+"/notes","POST",{body});
 }
 async whatsappConversations(){
  const conversations=await this.request<InboxConversation[]>("/inbox/conversations?limit=100&scope=all");
  return conversations.filter(c=>c.channel==="whatsapp"&&typeof c.crmPersonId==="string"&&c.crmPersonId.length>0);
 }
}
