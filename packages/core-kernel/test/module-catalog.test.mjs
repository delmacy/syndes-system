import assert from "node:assert/strict";
import test from "node:test";
import {AccessDeniedError, resolveApprovedModules} from "../dist/index.js";

const manifests = [
  {id:"platform",version:"0.1.0"},
  {id:"crm",version:"0.1.0",schema:"crm",dependencies:["platform"]},
  {id:"inbox",version:"0.1.0",schema:"inbox",dependencies:["platform","crm"]},
  {id:"whatsapp",version:"0.1.0",schema:"whatsapp",dependencies:["platform","crm","inbox"]},
];
const row = (id,dependencyId=null,extra={}) => ({
  moduleId:id,version:"0.1.0",schema:id,dependencyId,...extra
});

test("only trusted, approved build releases with all dependencies are available",()=>{
  const approved=[row("crm"),row("inbox","crm"),row("whatsapp","crm"),row("whatsapp","inbox")];
  assert.deepEqual(resolveApprovedModules(manifests,approved).map(x=>x.id),["crm","inbox","whatsapp"]);
  assert.deepEqual(resolveApprovedModules(manifests,approved.slice(1)).map(x=>x.id),[]);
  assert.deepEqual(resolveApprovedModules(manifests,[row("crm"),row("whatsapp","crm"),row("whatsapp","inbox")]).map(x=>x.id),["crm"]);
});
test("ignores releases absent from trusted build while matching only current version",()=>{
  const rows=[row("crm"),row("crm",null,{version:"0.2.0"}),row("thirdparty"),row("inbox","crm")];
  assert.deepEqual(resolveApprovedModules(manifests,rows).map(x=>x.id),["crm","inbox"]);
});
test("rejects catalog/schema/version metadata mismatch and injected dependencies",()=>{
  assert.throws(()=>resolveApprovedModules(manifests,[row("crm",null,{schema:"public"})]),AccessDeniedError);
  assert.throws(()=>resolveApprovedModules(manifests,[row("inbox",null)]),AccessDeniedError);
  assert.throws(()=>resolveApprovedModules(manifests,[row("inbox","untrusted")]),AccessDeniedError);
  assert.throws(()=>resolveApprovedModules(manifests,[row("inbox","crm"),row("inbox","crm")]),AccessDeniedError);
  assert.throws(()=>resolveApprovedModules(manifests,[row("crm",null,{dependencyId:undefined})]),AccessDeniedError);
});
test("legacy build without schema remains non-eligible, never promoted implicitly",()=>{
  assert.throws(()=>resolveApprovedModules([{id:"crm",version:"0.1.0"}],[row("crm")]),AccessDeniedError);
  assert.deepEqual(resolveApprovedModules([{id:"crm",version:"0.1.0"}],[]),[]);
});
