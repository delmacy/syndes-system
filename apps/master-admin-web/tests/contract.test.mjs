import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=relative=>readFileSync(new URL("../src/"+relative,import.meta.url),"utf8");
const app=read("App.tsx");
const shell=read("app/ManagerShell.tsx");
const view=read("app/view.ts");
const overview=read("features/overview/OverviewPage.tsx");
const tenants=read("features/tenants/TenantsPage.tsx");
const table=read("features/tenants/TenantTable.tsx");
const drawer=read("features/tenants/ClientDrawer.tsx");
const login=read("auth/LoginScreen.tsx");
const auth=read("auth.ts");

test("WBS 5.6: only two planned Manager routes and no placeholder billing",()=>{
 assert.match(view,/type View="overview"\|"clients"/);
 const declared=shell.split("const navigation:")[1].split("const roleNames:")[0];
 const ids=[...declared.matchAll(/id:"([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,["overview","clients"]);
 assert.match(shell,/Syndes Platform Manager/);
 for(const code of [app,shell,overview,tenants,drawer,login]){
  assert.doesNotMatch(code,/"operations"|"governance"|Assinaturas|Master Control|Master Admin/);
 }
});

test("WBS 5.3: unfiltered recent tenants independent from directory filters",()=>{
 assert.match(app,/setRecentTenants/);
 assert.match(app,/query:"",state:"all",page:1/);
 assert.match(app,/debouncedQuery,state:status,page/);
 assert.match(overview,/recentTenants\.items\.length/);
 assert.match(overview,/TenantTable compact items=\{recentTenants\.items\}/);
 assert.match(tenants,/TenantTable items=\{tenants\.items\}/);
});

test("WBS 5.5: details use a dedicated tenant API, never stale list row",()=>{
 assert.match(drawer,/api\.tenant\(tenantId,/);
 assert.match(drawer,/tenantId:string/);
 assert.match(drawer,/Carregando detalhes/);
 assert.match(table,/onSelect\(item\.id\)/);
 assert.match(app,/<ClientDrawer key=\{selected\} tenantId=\{selected\} api=\{api\}/);
 assert.doesNotMatch(app+drawer,/tenants\?\.items\.find\(x=>x\.id===selected\)/);
});

test("WBS 5.7: OIDC callback and logout use only the Manager origin",()=>{
 assert.match(auth,/window\.location\.origin\+"\/"/);
 assert.match(app,/window\.history\.replaceState\(null,"",window\.location\.origin\+"\/"\)/);
 assert.match(app,/if\(!token\|\|!operator\)return <LoginScreen/);
 assert.match(app,/api\.me\(controller\.signal\)/);
 assert.match(app,/if\(previewMode\)return;/);
 assert.match(login,/Entrar com Keycloak/);
});

test("UI composition: Manager shell, login and features remain separate",()=>{
 assert.ok(app.split("\n").length<125,"App must remain orchestration, not a new monolith");
 assert.match(app,/<ManagerShell/);
 assert.match(app,/<OverviewPage/);
 assert.match(app,/<TenantsPage/);
 assert.match(shell,/onSignOut/);
 assert.match(shell,/onRefresh/);
 assert.match(shell,/children/);
 for(const file of [shell,overview,tenants,drawer,login,table]){
  assert.match(file,/@syndes\/front-shared/);
 }
 assert.doesNotMatch(overview+tenants+table,/from ["']\.\.\/\.\.\/demo["']/);
});
