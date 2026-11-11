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
  connect(address:Address,res:SseSink,
    revalidate?:()=>Promise<boolean>,recheckIntervalMs=5000,recheckTimeoutMs=3000):void {
    if(revalidate&&(!Number.isInteger(recheckIntervalMs)||recheckIntervalMs<1||
      !Number.isInteger(recheckTimeoutMs)||recheckTimeoutMs<1))
      throw Error("Invalid SSE recheck interval/timeout");
    let closed=false;
    let unsubscribe=()=>{};
    let heartbeat:ReturnType<typeof setInterval>|undefined;
    let expiry:ReturnType<typeof setTimeout>|undefined;
    let recheck:ReturnType<typeof setInterval>|undefined;
    const cleanup=()=>{
      if(closed)return;closed=true;
      unsubscribe();
      if(heartbeat)clearInterval(heartbeat);
      if(expiry)clearTimeout(expiry);
      if(recheck)clearInterval(recheck);
    };
    const revoke=()=>{
      if(closed)return;
      cleanup();
      res.end();
    };
    // Recheck the actual authorized Context on invalidations and periodically,
    // never emit after revoke or a failed Control Plane/JWT/FGA check.
    let pending:Promise<boolean>|undefined;
    const authorized=():Promise<boolean>=>{
      if(closed)return Promise.resolve(false);
      if(!revalidate)return Promise.resolve(true);
      if(pending)return pending;
      let timeout:ReturnType<typeof setTimeout>|undefined;
      const timer=new Promise<boolean>(resolve=>{
        timeout=setTimeout(()=>resolve(false),recheckTimeoutMs);
        timeout.unref?.();
      });
      const check=Promise.race([Promise.resolve().then(revalidate),timer])
        .then(ok=>{
          if(ok!==true){revoke();return false;}
          return !closed;
        }).catch(()=>{revoke();return false;})
        .finally(()=>{if(timeout)clearTimeout(timeout);});
      pending=check;
      void check.finally(()=>{if(pending===check)pending=undefined;});
      return check;
    };
    const changed=()=>{
      if(closed)return;
      if(!revalidate){
        try{res.write(["event: changed","data: {}","",""].join("\n"));}
        catch{cleanup();}
        return;
      }
      void authorized().then(ok=>{
        if(!ok||closed)return;
        try{res.write(["event: changed","data: {}","",""].join("\n"));}
        catch{cleanup();}
      });
    };
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
    if(revalidate){
      recheck=setInterval(()=>{void authorized();},recheckIntervalMs);
      recheck.unref?.();
    }
    heartbeat.unref?.();expiry.unref?.();
  }
}
