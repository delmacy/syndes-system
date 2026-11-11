import test from "node:test";
import assert from "node:assert/strict";
import {InboxChangeBus,InboxService,inboxModule} from "../dist/index.js";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
test("tenant SSE invalidations never broadcast to other tenant",()=>{
 const bus=new InboxChangeBus(2);
 const outputA=[],outputB=[];
 const offA=bus.subscribe(A,()=>outputA.push("changed"));
 const offB=bus.subscribe(B,()=>outputB.push("changed"));
 bus.publish(A);
 assert.deepEqual(outputA,["changed"]);
 assert.deepEqual(outputB,[]);
 bus.publish(B);
 assert.deepEqual(outputB,["changed"]);
 offA();offB();
 assert.equal(bus.count(A),0);
 assert.equal(bus.count(B),0);
});

test("connection cleanup removes subscribers and enforces per-tenant cap",()=>{
 const bus=new InboxChangeBus(1);
 let close;
 const output=[],headers={};
 const response={
   setHeader:(k,v)=>headers[k]=v,
   write:data=>{output.push(data);return true;},
   end:()=>output.push("END"),
   on:(event,fn)=>{assert.equal(event,"close");close=fn;},
 };
 bus.connect(A,response);
 assert.equal(bus.count(A),1);
 assert.match(headers["Content-Type"],/text\/event-stream/);
 bus.publish(A);
 assert.ok(output.some(x=>x.includes("event: changed\ndata: {}\n\n")));
 assert.throws(()=>bus.connect(A,{...response}),/Too many/);
 close();
 assert.equal(bus.count(A),0);
 bus.publish(A);
 assert.equal(output.filter(x=>x.includes("event: changed")).length,2, "initial sync and one tenant mutation, no events after close");
});

test("SSE watch denies foreign tenancy and FGA before any tenant DB lease",async()=>{
 let selected=0;
 const kernel=new CoreKernel({
   modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]},inboxModule],
   tenancy:{canAccessTenant:async({actor,tenantId})=>tenantId===A && actor.id==="alice"},
   authorization:{canAccess:async({resource,action})=>resource==="inbox:conversations" && action==="read"},
 });
 await kernel.start();
 const service=new InboxService(kernel,async()=>{selected++;throw Error("Database should not open");});
 await service.watch({tenantId:A,actor:{id:"alice",kind:"user"}});
 await assert.rejects(service.watch({tenantId:B,actor:{id:"alice",kind:"user"}}),AccessDeniedError);
 await assert.rejects(service.watch({tenantId:A,actor:{id:"bob",kind:"user"}}),AccessDeniedError);
 assert.equal(selected,0);
});

test("enforced SSE immediately closes after a rejected module check and emits no stale event",async()=>{
 const bus=new InboxChangeBus();
 const scope={tenantId:A,organizationId:"33333333-3333-4333-8333-333333333333",
  workspaceId:"44444444-4444-4444-8444-444444444444"};
 const output=[];
 let close;
 let enabled=true;
 const sink={
  setHeader:()=>{},
  write:data=>{output.push(data);return true},
  end:()=>output.push("END"),
  on:(event,handler)=>{if(event==="close")close=handler},
 };
 bus.connect(scope,sink,async()=>enabled,10);
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(bus.count(scope),1);
 assert.equal(output.filter(x=>x.includes("event: changed")).length,1);
 enabled=false;
 bus.publish(scope);
 await new Promise(resolve=>setTimeout(resolve,30));
 assert.equal(bus.count(scope),0);
 assert.equal(output.filter(x=>x.includes("event: changed")).length,1);
 assert.equal(output.at(-1),"END");
 close();
});
test("enforced SSE closes on periodic check without publishing any event",async()=>{
 const bus=new InboxChangeBus();
 const output=[];
 let allowed=true;
 const sink={setHeader:()=>{},write:s=>{output.push(s);return true},end:()=>output.push("END"),on:()=>{}};
 bus.connect(A,sink,async()=>allowed,5);
 await new Promise(resolve=>setTimeout(resolve,10));
 allowed=false;
 await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(bus.count(A),0);
 assert.equal(output.at(-1),"END");
});
test("enforced SSE closes on failed provider, prevents in-flight writes after revoke",async()=>{
 const bus=new InboxChangeBus();
 let release;
 let fail=false;
 const output=[];
 const sink={setHeader:()=>{},write:s=>{output.push(s);return true},end:()=>output.push("END"),on:()=>{}};
 const scope={tenantId:A,organizationId:"33333333-3333-4333-8333-333333333333",
  workspaceId:"44444444-4444-4444-8444-444444444444"};
 const validate=()=>fail
  ?Promise.reject(Error("Control outage"))
  :new Promise(resolve=>{release=resolve});
 bus.connect(scope,sink,validate,200);
 await new Promise(resolve=>setImmediate(resolve));
 release(true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(bus.count(scope),1);
 fail=true;
 bus.publish(scope);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(bus.count(scope),0);
 assert.equal(output.at(-1),"END");
 assert.equal(output.filter(x=>x.includes("event: changed")).length,1);
});
test("SSE rejects a reauthorization that exceeds its timeout",async()=>{
 const bus=new InboxChangeBus();
 const messages=[];
 const sink={setHeader:()=>{},write:msg=>{messages.push(msg);return true},
  end:()=>messages.push("END"),on:()=>{}};
 bus.connect(A,sink,()=>new Promise(resolve=>setTimeout(()=>resolve(true),85)),10,20);
 await new Promise(resolve=>setTimeout(resolve,48));
 assert.equal(bus.count(A),0);
 assert.equal(messages.at(-1),"END");
 assert.equal(messages.some(x=>x.startsWith("event: changed")),false);
});
