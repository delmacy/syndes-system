import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {PgModuleInstaller} from "../dist/module-installer.js";

const sha=str=>createHash("sha256").update(str).digest("hex");
const manifest=(patch={})=>{
  const sql="CREATE TABLE crm.people(id UUID PRIMARY KEY)";
  return {
    id:"crm",schema:"crm",version:"0.1.0",dependencies:[],
    imageDigest:"sha256:"+sha("ci-fixture-image"),
    migrations:[{id:"001_people",version:"0.1.0",sql,checksum:sha(sql),
      expectedRelations:["crm.people"]}],
    ...patch,
  };
};
const db={query:async()=>({rows:[]})};
const resolver=async()=>{throw new Error("Fixture must not resolve tenant pool");};
test("trusted installer rejects malformed versions, SQL scopes and schema owners without DB access",()=>{
  const variants=[
    manifest({id:"crm;DROP"}),
    manifest({schema:"public"}),
    manifest({version:"latest"}),
    manifest({imageDigest:"latest"}),
    manifest({dependencies:["outside"]}),
    manifest({dependencies:["crm"]}),
    manifest({migrations:[]}),
    manifest({migrations:[{...manifest().migrations[0],checksum:"f".repeat(64)}]}),
    manifest({migrations:[{...manifest().migrations[0],expectedRelations:["public.people"]}]}),
  ];
  for(const item of variants)assert.throws(()=>new PgModuleInstaller(db,resolver,[item]));
});
test("never accepts duplicate releases/migration identifiers",()=>{
  assert.throws(()=>new PgModuleInstaller(db,resolver,[manifest(),manifest()]));
  const first=manifest().migrations[0];
  assert.throws(()=>new PgModuleInstaller(db,resolver,[manifest({
    migrations:[first,first],
  })]));
});
test("no runtime input can select a module absent from trusted registry",async()=>{
  const installer=new PgModuleInstaller(db,resolver,[manifest()]);
  await assert.rejects(installer.plan("10000000-0000-4000-8000-000000000001","unknown"),/Access denied/);
  await assert.rejects(installer.apply("10000000-0000-4000-8000-000000000001","../../unknown"),/Access denied/);
});
test("constructor accepts immutable, exact trusted release metadata",()=>{
  const installer=new PgModuleInstaller(db,resolver,[manifest()]);
  assert.ok(installer);
});
