/** Single-Core-Host SSE notification bus.
 * Events carry NO message/customer data; clients re-fetch via authorized REST.
 * For multiple Core Host replicas, replace this with a shared broker.
 */
export interface SseSink {
  setHeader(name:string,value:string):void;
  write(chunk:string):boolean;
  end():void;
  on(event:"close",listener:()=>void):void;
}
type Listener=()=>void;
/** Old tenant-only messages are intentionally isolated from scoped clients. */
export type InboxNotificationScope=Readonly<{tenantId:string;organizationId?:string;workspaceId?:string}>;
type Address=string|InboxNotificationScope;
const channel=(address:Address)=>typeof address==="string"
 ? "tenant:"+address
 : address.organizationId&&address.workspaceId
   ? "workspace:"+JSON.stringify([address.tenantId,address.organizationId,address.workspaceId])
   : (()=>{throw Error("Verified Inbox event scope is required")})();
export class InboxChangeBus {
  private readonly clients=new Map<string,Set<Listener>>();
  constructor(private readonly maxPerTenant=60){}
  subscribe(address:Address,listener:Listener):()=>void {
    const tenantId=channel(address);
    let subscriptions=this.clients.get(tenantId);
    if(!subscriptions){subscriptions=new Set();this.clients.set(tenantId,subscriptions);}
    if(subscriptions.size>=this.maxPerTenant)throw new Error("Too many Inbox subscribers");
    subscriptions.add(listener);
    return ()=>{
      subscriptions?.delete(listener);
      if(!subscriptions?.size)this.clients.delete(tenantId);
    };
  }
  publish(address:Address):void {
    const tenantId=channel(address);
    // Listener exceptions must never turn an already-committed write into an API 503.
    for(const listener of this.clients.get(tenantId)??[]){
      try{listener()}catch{/* disconnected client */}
    }
  }
  count(address:Address):number{return this.clients.get(channel(address))?.size??0;}
  /**
   * Fixed expiry ensures authorization/JWT are rechecked every 60 seconds.
   * Heartbeats keep reverse proxies from buffering or closing idle streams.
   */
  connect(address:Address,res:SseSink):void {
    let closed=false;
    let unsubscribe=()=>{};
    let heartbeat:ReturnType<typeof setInterval>|undefined;
    let expiry:ReturnType<typeof setTimeout>|undefined;
    const cleanup=()=>{
      if(closed)return;closed=true;
      unsubscribe();
      if(heartbeat)clearInterval(heartbeat);
      if(expiry)clearTimeout(expiry);
    };
    const changed=()=>{if(!closed)res.write(["event: changed","data: {}","",""].join("\n"));};
    unsubscribe=this.subscribe(address,changed);
    res.setHeader("Content-Type","text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control","no-store, no-transform");
    res.setHeader("X-Accel-Buffering","no");
    res.setHeader("Connection","keep-alive");
    res.on("close",cleanup);
    res.write(": inbox-connected\n\n");
    // Rebuild the authorized snapshot on every new or reconnected stream.
    changed();
    heartbeat=setInterval(()=>{
      if(!closed)try{res.write(": keepalive\n\n")}catch{cleanup();}
    },15000);
    expiry=setTimeout(()=>{
      if(closed)return;
      cleanup();
      res.end();
    },60000);
    heartbeat.unref?.();expiry.unref?.();
  }
}
