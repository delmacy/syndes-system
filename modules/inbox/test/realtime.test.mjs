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
