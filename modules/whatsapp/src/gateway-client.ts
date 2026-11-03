import {createHmac} from "node:crypto";
export class WhatsAppGatewayClient {
 constructor(private readonly base=process.env.WHATSAPP_GATEWAY_URL,
 private readonly secret=process.env.WHATSAPP_WHATSMEOW_TOKEN){}
 private token(tenantId:string,accountId:string){
  if(!this.secret||!this.base)throw Error("WhatsApp gateway not configured");
  return createHmac("sha256",this.secret).update("syndes-whatsapp-v1:"+tenantId+":"+accountId).digest("hex");
 }
 private async request(tenantId:string,accountId:string,operation:string,method="POST",body?:unknown){
  const url=new URL(this.base!);
  if(url.protocol!=="http:"||!["whatsapp-gateway","127.0.0.1","localhost"].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=="/")
   throw Error("Invalid gateway private URL");
  const response=await fetch(new URL("/v1/accounts/"+accountId+"/"+operation,url),{
   method,headers:{Authorization:"Bearer "+this.token(tenantId,accountId),...(body?{"Content-Type":"application/json"}:{})},
   ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000),redirect:"error",
  });
  if(!response.ok)throw Error("WhatsApp gateway operation unavailable ("+response.status+")");
  return response.status===204?null:response.json();
 }
 async register(tenantId:string,accountId:string){
  const url=new URL(this.base!);
  if(url.hostname!=="whatsapp-gateway"&&url.hostname!=="127.0.0.1"&&url.hostname!=="localhost")throw Error("Invalid gateway hostname");
  const token=createHmac("sha256",this.secret??"").update("syndes-whatsapp-v1:"+tenantId+":tenant-registry").digest("hex");
  const res=await fetch(new URL("/v1/tenants/"+tenantId+"/accounts",url),{method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({accountId}),signal:AbortSignal.timeout(10000),redirect:"error"});
  if(!res.ok)throw Error("Gateway registration failed");
 }
 async list(tenantId:string):Promise<Array<{accountId:string;tenantId:string;deviceJid:string|null;enabled:boolean;connected:boolean}>>{
  if(!this.base||!this.secret)throw Error("WhatsApp gateway not configured");
  const url=new URL(this.base);
  if(url.protocol!=="http:"||!["whatsapp-gateway","127.0.0.1","localhost"].includes(url.hostname))throw Error("Invalid gateway URL");
  const token=createHmac("sha256",this.secret).update("syndes-whatsapp-v1:"+tenantId+":tenant-registry").digest("hex");
  const response=await fetch(new URL("/v1/tenants/"+tenantId+"/accounts",url),{
   headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(10000),redirect:"error"
  });
  if(!response.ok)throw Error("Gateway session registry unavailable");
  return response.json() as Promise<Array<{accountId:string;tenantId:string;deviceJid:string|null;enabled:boolean;connected:boolean}>>;
 }
 async setEnabled(tenantId:string,accountId:string,enabled:boolean):Promise<{enabled:boolean}>{
  if(!this.base||!this.secret)throw Error("WhatsApp gateway not configured");
  const url=new URL(this.base);
  if(url.protocol!=="http:"||!["whatsapp-gateway","127.0.0.1","localhost"].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=="/")throw Error("Invalid gateway private URL");
  const token=createHmac("sha256",this.secret).update("syndes-whatsapp-v1:"+tenantId+":tenant-registry").digest("hex");
  const response=await fetch(new URL("/v1/tenants/"+tenantId+"/accounts/"+accountId+"/enabled",url),{
   method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({enabled}),signal:AbortSignal.timeout(10000),redirect:"error",
  });
  if(!response.ok)throw Error("Gateway account state unavailable ("+response.status+")");
  return response.json() as Promise<{enabled:boolean}>;
 }
 async sendQueued(tenantId:string,accountId:string,input:{idempotencyKey:string;recipientExternalId:string;body:string}):Promise<{queueId:number}>{
  const result=await this.request(tenantId,accountId,"messages","POST",input) as {queueId?:unknown};
  if(!result||!Number.isSafeInteger(result.queueId)||Number(result.queueId)<=0)throw Error("Invalid gateway queue confirmation");
  return {queueId:Number(result.queueId)};
 }
 async outboundStatus(tenantId:string,accountId:string,queueId:number):Promise<{status:"pending"|"processing"|"sent"|"failed";externalMessageId?:string}>{
  if(!this.base||!this.secret||!Number.isSafeInteger(queueId)||queueId<=0)throw Error("Invalid outbound status query");
  const url=new URL(this.base);
  if(url.protocol!=="http:"||!["whatsapp-gateway","127.0.0.1","localhost"].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=="/")
   throw Error("Invalid gateway private URL");
  const token=createHmac("sha256",this.secret).update("syndes-whatsapp-v1:"+tenantId+":tenant-registry").digest("hex");
  const resp=await fetch(new URL("/v1/tenants/"+tenantId+"/accounts/"+accountId+"/outbox/"+queueId,url),{
   headers:{Authorization:"Bearer "+token},redirect:"error",signal:AbortSignal.timeout(10000)
  });
  if(!resp.ok)throw Error("Gateway outbound status unavailable ("+resp.status+")");
  const value=await resp.json() as {status?:unknown;externalMessageId?:unknown};
  if(!value||!["pending","processing","sent","failed"].includes(String(value.status)))throw Error("Invalid gateway outbound state");
  if(value.externalMessageId!==undefined && (typeof value.externalMessageId!=="string"||value.externalMessageId.length>160))
   throw Error("Invalid gateway external message ID");
  return {status:value.status as "pending"|"processing"|"sent"|"failed",...(typeof value.externalMessageId==="string"?{externalMessageId:value.externalMessageId}:{})};
 }
 async requestHistory(tenantId:string,accountId:string,history:{
  chatExternalId:string;messageId:string;timestamp:string;fromMe:boolean;count:number
 }):Promise<{requested:boolean}>{
  if(!this.base||!this.secret)throw Error("WhatsApp gateway not configured");
  const url=new URL(this.base);
  if(url.protocol!=="http:"||!["whatsapp-gateway","127.0.0.1","localhost"].includes(url.hostname)||
    url.username||url.password||url.search||url.hash||url.pathname!=="/")throw Error("Invalid gateway private URL");
  const token=createHmac("sha256",this.secret)
    .update("syndes-whatsapp-v1:"+tenantId+":tenant-registry").digest("hex");
  const response=await fetch(new URL("/v1/tenants/"+tenantId+"/accounts/"+accountId+"/history",url),{
   method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify(history),signal:AbortSignal.timeout(18000),redirect:"error"
  });
  if(response.status!==202)throw Error("Historical sync request unavailable ("+response.status+")");
  return response.json() as Promise<{requested:boolean}>;
 }
 async lookupContactNames(tenantId:string,accountId:string,jids:readonly string[]):Promise<Record<string,string>> {
  if(!this.base||!this.secret||jids.length===0||jids.length>100)throw Error("Invalid contact lookup");
  const url=new URL(this.base);
  if(url.protocol!=="http:"||!["whatsapp-gateway","127.0.0.1","localhost"].includes(url.hostname)||
    url.username||url.password||url.search||url.hash||url.pathname!=="/")
   throw Error("Invalid gateway private URL");
  const token=createHmac("sha256",this.secret)
    .update("syndes-whatsapp-v1:"+tenantId+":tenant-registry").digest("hex");
  const response=await fetch(new URL("/v1/tenants/"+tenantId+"/accounts/"+accountId+"/contacts/lookup",url),{
   method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify({jids}),signal:AbortSignal.timeout(6000),redirect:"error"
  });
  if(!response.ok)throw Error("WhatsApp contacts unavailable ("+response.status+")");
  const payload=await response.json() as {names?:unknown};
  if(!payload.names||typeof payload.names!=="object"||Array.isArray(payload.names))
   throw Error("Invalid WhatsApp contact response");
  const permitted=new Set(jids);
  const out:Record<string,string>={};
  for(const [jid,name] of Object.entries(payload.names)){
   if(permitted.has(jid)&&typeof name==="string"&&name.trim()&&[...name].length<=160)
     out[jid]=name.trim();
  }
  return out;
 }
 async setContactName(tenantId:string,accountId:string,input:{
   contactJid:string;fullName:string;saveOnPrimaryAddressbook:boolean
 }):Promise<{submitted:true;confirmedOnPhone:false}>{
   if(!this.base||!this.secret)throw Error("WhatsApp gateway not configured");
   const url=new URL(this.base);
   if(url.protocol!=="http:"||!["whatsapp-gateway","127.0.0.1","localhost"].includes(url.hostname)||
      url.username||url.password||url.search||url.hash||url.pathname!=="/")
    throw Error("Invalid gateway private URL");
   const token=createHmac("sha256",this.secret)
     .update("syndes-whatsapp-v1:"+tenantId+":tenant-registry").digest("hex");
   const res=await fetch(new URL("/v1/tenants/"+tenantId+"/accounts/"+accountId+"/contacts/name",url),{
    method:"PATCH",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
    body:JSON.stringify(input),signal:AbortSignal.timeout(18000),redirect:"error"
   });
   if(res.status!==202)throw Error("WhatsApp contact change was not accepted ("+res.status+")");
   return res.json() as Promise<{submitted:true;confirmedOnPhone:false}>;
 }
 pair(tenantId:string,accountId:string){return this.request(tenantId,accountId,"pairing")}
 connect(tenantId:string,accountId:string){return this.request(tenantId,accountId,"connect")}
 disconnect(tenantId:string,accountId:string){return this.request(tenantId,accountId,"disconnect")}
}
