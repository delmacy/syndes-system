import assert from "node:assert/strict";
import test from "node:test";
import {createHash} from "node:crypto";
import {loadTrustedServiceRelease} from "../dist/service-release.js";
import {PgModuleInstaller} from "../dist/module-installer.js";

const digest="sha256:"+createHash("sha256").update("synthetic-build").digest("hex");
const sha=sql=>createHash("sha256").update(sql).digest("hex");
const mockDb={query:async()=>{throw Error("Unexpected Control access")}};
const noTenants=async()=>{throw Error("Unexpected tenant provider access")};

test("Service release manifest uses canonical ID, isolated schema and SQL checksum",async()=>{
 const manifest=await loadTrustedServiceRelease(digest);
 assert.equal(manifest.id,"service");
 assert.equal(manifest.schema,"service");
 assert.equal(manifest.version,"0.3.0");
 assert.deepEqual(manifest.dependencies,["organizations","crm","inbox"]);
 assert.deepEqual(manifest.migrations.map(x=>x.id),[
  "001_service_funnels","002_service_team_transfer",
  "003_service_conversation_inspector"]);
 for(const migration of manifest.migrations){
  assert.equal(migration.version,"0.3.0");
  assert.equal(migration.checksum,sha(migration.sql));
  assert.ok(migration.expectedRelations.every(x=>x.startsWith("service.")));
  assert.doesNotMatch(migration.sql,/^\s*(BEGIN|COMMIT)\s*;/im,
   "No top-level transaction escape from trusted installer");
 }
 assert.match(manifest.migrations[0].sql,
  /CREATE TABLE IF NOT EXISTS service\.service_attendances/);
 assert.match(manifest.migrations[1].sql,
  /REFERENCES public\.platform_staff_team_workspaces/);
 assert.match(manifest.migrations[2].sql,
  /to_regprocedure\('service\.service_team_can_read/);
 assert.equal(new PgModuleInstaller(mockDb,noTenants,[
  ...["organizations","crm","inbox"].map(id=>({
    id,schema:id,version:"0.1.0",dependencies:[],
    imageDigest:digest,migrations:[{
      id:"001_fixture",version:"0.1.0",sql:"CREATE TABLE "+id+".fixture(id UUID);",
      checksum:sha("CREATE TABLE "+id+".fixture(id UUID);"),
      expectedRelations:[id+".fixture"],
    }],
  })),
  manifest,
 ]) instanceof PgModuleInstaller,true);
});

test("Service release requires operator-verified digest, no caller-selected SQL",async()=>{
 for(const fake of ["latest","","sha256:broken","a".repeat(64),undefined])
  await assert.rejects(loadTrustedServiceRelease(fake),/digest/);
 const first=await loadTrustedServiceRelease(digest);
 const again=await loadTrustedServiceRelease(digest);
 assert.deepEqual(first,again,"Immutable compiled release manifest must be deterministic");
 assert.ok(Object.isFrozen(first));
 assert.ok(Object.isFrozen(first.migrations));
});
