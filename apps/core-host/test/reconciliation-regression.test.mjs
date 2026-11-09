import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

// Cross-branch add/add merges can create duplicate decorated Nest endpoints without
// generating a Git conflict. Always guard the merged source, not only the branch.
const root=new URL("../../../",import.meta.url);
const read=path=>readFile(new URL(path,root),"utf8");

test("mainline reconciliation cannot duplicate CRM, Inbox or Support HTTP routes",async()=>{
 for(const file of [
  "modules/core-crm/src/crm.controller.ts",
  "modules/inbox/src/inbox.controller.ts",
  "modules/support/src/controller.ts"
 ]){
  const source=await read(file);
  const decorators=[...source.matchAll(/^\s*@(Get|Post|Patch|Delete)\("([^"]+)"\)/gm)];
  assert.ok(decorators.length>0,file+" must expose typed routes");
  const seen=new Set();
  for(const match of decorators){
   const key=match[1]+":"+match[2];
   assert.equal(seen.has(key),false,file+" has a duplicate "+key);
   seen.add(key);
  }
 }
});
test("CRM capability and relationship routes preserve selected org/workspace context",async()=>{
 const crm=await read("modules/core-crm/src/crm.controller.ts");
 for(const route of ["capabilities","tags","people/:id/organizations/:organizationId","people/:id/tags/:tagId"]){
  const decorator=route==="people/:id/organizations/:organizationId"||route==="people/:id/tags/:tagId"?"Delete":"Get";
  const index=crm.indexOf('@'+decorator+'("'+route+'")');
  assert.ok(index>=0,"missing "+route);
  assert.match(crm.slice(index,index+410),/@SelectedScope\(\)/,route+" needs selected scope");
 }
 assert.match(crm,/if\(action==="write"&&c\.scopeWriteAllowed===false\)/,
  "CRM capability flags may not advertise write privileges on read-only scopes");
});
test("Inbox SSE remains one scoped, authorized endpoint",async()=>{
 const inbox=await read("modules/inbox/src/inbox.controller.ts");
 const service=await read("modules/inbox/src/service.ts");
 assert.equal([...inbox.matchAll(/@Get\("events"\)/g)].length,1);
 assert.equal([...service.matchAll(/\bwatch\(ctx:InboxContext\):Promise<void>/g)].length,1);
 assert.match(inbox,/@Get\("events"\)\s+async eventsStream\([^\n]*@SelectedScope\(\)/);
 assert.match(inbox,/this\.host\.events\.connect\(context,response\)/,
  "SSE connection must carry the scoped authorization context");
 assert.doesNotMatch(inbox,/this\.host\.events\.connect\(t,response\)/,
  "Tenant-only SSE must not be reintroduced by mainline reconciliation");
});
