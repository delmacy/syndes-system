import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
const auth=readFileSync(new URL("../src/auth.ts",import.meta.url),"utf8");
test("WBS 5.6: no future navigation or placeholder billing",()=>{
 assert.match(source,/type View="overview"\|"clients"/);
 assert.doesNotMatch(source,/"operations"|"governance"|Assinaturas|Explorar operação|Próxima etapa|Em breve/);
 assert.match(source,/Syndes Platform Manager/);
 assert.doesNotMatch(source,/Master Control|Master Admin|Navegação do Master Admin/);
});
test("WBS 5.3: recent tenants do not inherit directory filters",()=>{
 assert.match(source,/setRecentTenants/);
 assert.match(source,/query:"",state:"all",page:1/);
 assert.match(source,/recentTenants\.items\.length/);
 assert.match(source,/TenantTable compact items=\{recentTenants\.items\}/);
});
test("WBS 5.5: drawer uses dedicated API, not a stale list row",()=>{
 assert.match(source,/api\.tenant\(tenantId,/);
 assert.match(source,/tenantId:string/);
 assert.match(source,/Carregando detalhes/);
 assert.doesNotMatch(source,/tenants\?\.items\.find\(x=>x\.id===selected\)/);
});
test("WBS 5.7: both callback and logout target origin root",()=>{
 assert.match(auth,/window\.location\.origin\+"\/"/);
 assert.match(source,/window\.history\.replaceState\(null,"",window\.location\.origin\+"\/"\)/);
});
