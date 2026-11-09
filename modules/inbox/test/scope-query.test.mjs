import test from "node:test";
import assert from "node:assert/strict";
import {inboxScopedQuery} from "../dist/scope-query.js";
import {InboxTenantMismatchError} from "../dist/contracts.js";
const T="11111111-1111-4111-8111-111111111111",O="22222222-2222-4222-8222-222222222222",W="33333333-3333-4333-8333-333333333333";
const scope={organizationId:O,workspaceId:W};
test("Inbox org + current workspace bound in SQL with no interpolated user values",async()=>{
 const seen=[];
 const db={tenantId:T,query:async(sql,params)=>{seen.push({sql,params});return {rows:[]}}};
 await inboxScopedQuery(db,scope,"SELECT 1 WHERE id=$1::uuid /*SCOPE: AND org=@@ORG@@ AND workspace=@@WS@@*/",[T]);
 assert.deepEqual(seen[0].params,[T,O,W]);
 assert.match(seen[0].sql,/org=\$2::uuid AND workspace=\$3::uuid/);
 assert.doesNotMatch(seen[0].sql,new RegExp(O));
 assert.doesNotMatch(seen[0].sql,/@\@|\/\*SCOPE/);
});
test("legacy direct callers retain plain SQL, partial owner scope must fail closed",async()=>{
 const seen=[];
 const db={tenantId:T,query:async(sql,params)=>{seen.push({sql,params});return {rows:[]}}};
 await inboxScopedQuery(db,undefined,"SELECT 1 /*SCOPE:WHERE org=@@ORG@@ AND ws=@@WS@@*/",[]);
 assert.equal(seen[0].sql.trim(),"SELECT 1");
 assert.throws(()=>inboxScopedQuery(db,{organizationId:O},"SELECT 1 /*SCOPE: WHERE org=@@ORG@@ AND ws=@@WS@@*/",[]),InboxTenantMismatchError);
 assert.throws(()=>inboxScopedQuery(db,scope,"SELECT 1",[]),/lacks organization\/workspace/);
 assert.throws(()=>inboxScopedQuery(db,scope,"SELECT 1 /*SCOPE: WHERE org=@@ORG@@*/",[]),/lacks organization\/workspace/);
 assert.throws(()=>inboxScopedQuery(db,scope,"SELECT 1 /*SCOPE: WHERE ws=@@WS@@*/",[]),/lacks organization\/workspace/);
 assert.throws(()=>inboxScopedQuery(db,{organizationId:"'; DROP TABLE x;",workspaceId:W},"SELECT 1 /*SCOPE: WHERE org=@@ORG@@ AND ws=@@WS@@*/",[]),InboxTenantMismatchError);
 assert.equal(seen.length,1,"all invalid scopes rejected before DB");
});
