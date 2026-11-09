import test from "node:test";
import assert from "node:assert/strict";
import {reconcileInboxThread} from "../src/features/inbox-thread.ts";

test("identical receipt refresh preserves the current history reference and scroll stability",()=>{
 const existing=[{id:"1",body:"one",deliveryStatus:"sent"},{id:"2",body:"two",deliveryStatus:"read"}];
 const repeated=existing.map(m=>({...m}));
 assert.strictEqual(reconcileInboxThread(existing,repeated),existing);
});
test("provider delivery receipt updates the message without deleting earlier history",()=>{
 const existing=[{id:"1",body:"older",deliveryStatus:"read"},{id:"2",body:"newer",deliveryStatus:"processing"}];
 const refreshed=[{...existing[0]},{...existing[1],deliveryStatus:"delivered"}];
 assert.deepEqual(reconcileInboxThread(existing,refreshed),refreshed);
 assert.equal(reconcileInboxThread(existing,refreshed).length,2);
});
test("new messages and different order do not collapse into stale history",()=>{
 const existing=[{id:"1",body:"first"}];
 const next=[...existing,{id:"2",body:"second"}];
 assert.strictEqual(reconcileInboxThread(existing,next),next);
 assert.strictEqual(reconcileInboxThread(next,[...next].reverse())[0].id,"2");
});
test("edits to body, source or metadata are never discarded as unchanged",()=>{
 const old=[{id:"1",body:"original",source:"history",meta:{flag:true}}];
 for(const latest of [
  [{...old[0],body:"edited"}],
  [{...old[0],source:"live"}],
  [{...old[0],extra:"metadata"}],
 ]) assert.notStrictEqual(reconcileInboxThread(old,latest),old);
});
