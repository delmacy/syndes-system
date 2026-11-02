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
 pair(tenantId:string,accountId:string){return this.request(tenantId,accountId,"pairing")}
 connect(tenantId:string,accountId:string){return this.request(tenantId,accountId,"connect")}
 disconnect(tenantId:string,accountId:string){return this.request(tenantId,accountId,"disconnect")}
}
