import test from "node:test";
import assert from "node:assert/strict";
import {readFile,access,readdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";

const pkgRoot=new URL("../",import.meta.url);
const repoRoot=new URL("../../../",import.meta.url);
const source=async p=>readFile(new URL(p,pkgRoot),"utf8");
const appSource=async p=>readFile(new URL(p,repoRoot),"utf8");
const primitives=["button","input","badge","card","separator"];

test("one canonical implementation of each shared primitive, no leftover workspace clones",async()=>{
 for(const name of primitives){
  const code=await source("src/components/"+name+".tsx");
  assert.ok(code.length>100,name+" is not an empty placeholder");
  await assert.rejects(access(fileURLToPath(new URL(
   "apps/workspace-web/src/components/ui/"+name+".tsx",repoRoot))),
   "Duplicate local component "+name);
 }
});

test("shared package cannot import auth, tenant, network or application features",async()=>{
 const files=await readdir(new URL("../src/components/",import.meta.url));
 for(const file of files){
  const code=await source("src/components/"+file);
  assert.doesNotMatch(code,/(?:fetch\(|localStorage|sessionStorage|useAuth|Keycloak|tenantId|workspaceId|\bOpenFGA\b|\/v1\/|\.\.\/\.\.\/apps|@\/)/,
   "Cross-context dependency in "+file);
 }
});

test("both independent frontends use the same actual shared component implementations",async()=>{
 const manager=await appSource("apps/master-admin-web/src/App.tsx");
 assert.match(manager,/from "@syndes\/front-shared"/);
 assert.match(manager,/<Button unstyled\b/);
 assert.match(manager,/<Input unstyled\b/);
 assert.match(manager,/<Badge unstyled\b/);
 assert.match(manager,/<Card unstyled\b/);
 const ws=await appSource("apps/workspace-web/src/features/crm.tsx");
 assert.match(ws,/from "@syndes\/front-shared\/button"/);
 assert.match(ws,/from "@syndes\/front-shared\/input"/);
 assert.match(ws,/from "@syndes\/front-shared\/badge"/);
 assert.match(ws,/from "@syndes\/front-shared\/card"/);
});

test("React is externalized and normal manager authentication remains enabled",async()=>{
 const manifest=JSON.parse(await source("package.json"));
 assert.ok(manifest.peerDependencies.react && manifest.peerDependencies["react-dom"]);
 assert.equal(manifest.private,true);
 const manager=await appSource("apps/master-admin-web/src/App.tsx");
 assert.match(manager,/if\(previewMode\)return;/);
 assert.match(manager,/finishLogin\(cfg\)/);
 assert.match(manager,/new MasterApi\(token\)/);
});

test("fresh CI and Docker builds bootstrap source package without touching workflows",async()=>{
 for(const app of ["master-admin-web","workspace-web"]){
  const manifest=JSON.parse(await appSource("apps/"+app+"/package.json"));
  assert.match(manifest.scripts.prebuild,/front-shared\/scripts\/ensure-installed\.mjs/);
  assert.match(manifest.scripts.predev,/front-shared\/scripts\/ensure-installed\.mjs/);
 }
 const mgr=JSON.parse(await appSource("apps/master-admin-web/package.json"));
 assert.match(mgr.scripts["prebuild:visual-preview"],/front-shared\/scripts\/ensure-installed\.mjs/);
 const docker=await appSource("apps/master-admin-web/Dockerfile");
 assert.match(docker,/COPY packages\/front-shared\//);
 assert.match(docker,/WORKDIR \/repo/);
 assert.match(docker,/RUN cd apps\/master-admin-web && npm run build/);
 const installer=await source("scripts/ensure-installed.mjs");
 assert.match(installer,/spawnSync/);
 assert.match(installer,/node_modules/);
});
