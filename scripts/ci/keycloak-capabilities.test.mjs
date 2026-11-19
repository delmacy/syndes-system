import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const catalog=JSON.parse(readFileSync("catalog/iam-capabilities.v1.json","utf8"));
const modulePaths={
  crm:"modules/core-crm/src/plugin.ts",
  inbox:"modules/inbox/src/plugin.ts",
  service:"modules/service-management/src/plugin.ts",
  whatsapp:"modules/whatsapp/src/plugin.ts"
};

test("IAM capability catalog is a versioned inventory, not a second grant store",()=>{
  assert.equal(catalog.schemaVersion,1);
  assert.ok(catalog.purpose.includes("NOT an authorization grant source"));
  assert.ok(Array.isArray(catalog.entries) && catalog.entries.length>=7);
  const ids=new Set();
  for(const e of catalog.entries){
    assert.match(e.id,/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*){2,3}$/);
    assert.equal(e.id.split(".")[0],e.module);
    assert.ok(!ids.has(e.id),"duplicate "+e.id);
    ids.add(e.id);
    assert.ok(["workspace","funnel"].includes(e.resourceKind));
    assert.ok(["declared_legacy","proposed"].includes(e.status));
    assert.ok(Object.hasOwn(modulePaths,e.module));
    if(e.status==="proposed"){
      assert.equal(e.legacy,null,"proposed actions must not inherit broad permissions");
      continue;
    }
    assert.ok(e.legacy && ["read","write"].includes(e.legacy.action));
    const source=readFileSync(modulePaths[e.module],"utf8");
    const marker='resource:"'+e.legacy.resource+'",actions:[';
    const start=source.indexOf(marker);
    assert.ok(start!==-1,"legacy resource missing: "+e.legacy.resource);
    const end=source.indexOf("]",start+marker.length);
    const actions=source.slice(start+marker.length,end);
    assert.ok(actions.includes('"'+e.legacy.action+'"'),"legacy action missing: "+e.id);
  }
});

test("UMA and fine-FGA resolve every explicit catalog capability without a legacy grant",()=>{
 const source=readFileSync("apps/core-host/src/keycloak-authorization-pilot.ts","utf8");
 const exact=readFileSync("apps/core-host/src/iam07d-capability-catalog.ts","utf8");
 const context=readFileSync("apps/core-host/src/iam-organization-context-pilot.ts","utf8");
 const old=["inbox.conversation.read","inbox.message.send"];
 for(const id of old){
  const entry=catalog.entries.find(x=>x.id===id);
  assert.ok(entry,"legacy pilot capability absent: "+id);
  assert.ok(source.includes('"'+id+'":"'+entry.resourceKind+'"')||
   source.includes('"'+id+'": "'+entry.resourceKind+'"'),
   "legacy kind mismatch: "+id);
 }
 assert.match(source,/Object\.fromEntries\(IAM07D_CAPABILITIES\.map/);
 assert.match(context,/Object\.fromEntries\(IAM07D_CAPABILITIES\.map/);
 const candidates=catalog.entries.filter(x=>x.status==="proposed"&&
   ["inbox","service"].includes(x.module));
 const captured=exact.match(/export const IAM07D_CAPABILITIES=Object\\.freeze\\((\\[[\\s\\S]*?\\]) as const\\)/);
 assert.ok(captured,"Typed capability array must be explicit");
 const known=JSON.parse(captured[1]);
 assert.equal(known.length,19,"Every exact mutation has one typed name");
 assert.equal(new Set(known).size,19);
 for(const id of known){
  const entry=catalog.entries.find(x=>x.id===id);
  assert.ok(entry&&entry.status==="proposed","No implicit grants: "+id);
 }
 for(const entry of candidates)
  assert.ok(known.includes(entry.id),"Inventory missing exact capability: "+entry.id);
 assert.ok(exact.includes('"service.attendance.team_transfer"'));
 assert.ok(source.includes("response_mode: \"decision\""));
 assert.ok(source.includes("submit_request: \"false\""));
 assert.ok(!source.includes("client_secret"));
 assert.ok(!source.includes("create-policy"));
});
