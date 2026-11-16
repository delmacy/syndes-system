import test from "node:test";
import assert from "node:assert/strict";
import { crmSections, domains } from "../lib/content.js";

test("CRM has exactly twelve unique approved editorial topics",()=>{
  assert.equal(crmSections.length,12);
  assert.equal(new Set(crmSections.map(s=>s.id)).size,12);
  assert.deepEqual(crmSections.map(s=>s.number),Array.from({length:12},(_,i)=>String(i).padStart(2,"0")));
});
test("Every section provides human-readable narrative and source links at the end",()=>{
  for(const section of crmSections){
    assert.ok(section.lead.length>35,section.id);
    assert.ok(section.paragraphs.length>=1,section.id);
    assert.ok(section.references.length>=1,section.id);
    for(const ref of section.references)assert.match(ref.href,/^https:\/\/github\.com\/delmacy\/syndes-system\//);
  }
});
test("Source evidence does not claim unverified product acceptance",()=>{
  const state=crmSections[0];
  assert.match(state.lead,/não está homologada|não estão homologad/i);
  assert.match(state.paragraphs.join(" "),/Product Gate/);
  assert.ok(domains.filter(d=>d.pilot).length===1);
});

test("Cada um dos 12 tópicos possui inventário técnico e fontes verificáveis",async()=>{
  const {CRM_EVIDENCE,evidenceIds}=await import("../lib/crm-evidence.js");
  assert.equal(evidenceIds.length,12);
  assert.deepEqual(new Set(evidenceIds),new Set(crmSections.map(section=>section.id)));
  for(const section of crmSections){
    const e=CRM_EVIDENCE[section.id];
    assert.ok(e.intro.length>25,section.id);
    assert.ok(e.blocks.length>=1,section.id);
    for(const block of e.blocks){
      assert.ok(block.heading.length>=8,section.id);
      assert.ok(block.rows.length>=3,section.id);
      assert.equal(block.headers.length,2,section.id);
      assert.ok(block.rows.every(cells=>cells.length===2),section.id);
      assert.ok(block.references.length>=1,section.id);
      for(const source of block.references)assert.ok(source.href.startsWith("https://github.com/delmacy/syndes-system/"));
    }
  }
});
test("Distingue código encontrado de homologação de produto",async()=>{
  const {CRM_EVIDENCE}=await import("../lib/crm-evidence.js");
  const all=Object.values(CRM_EVIDENCE).flatMap(e=>e.blocks).flatMap(b=>b.rows).flat().join(" ");
  for(const required of ["b452a03e","29 PASS","Product Gate","crm_people","CrmService","crm:people","inbox.participant.observed.v1","50.02"]){
    assert.ok(all.includes(required),required);
  }
});

test("Funções do CRM particionam os doze assuntos sem duplicidade",async()=>{
  const {crmFunctions,crmFunctionForSection}=await import("../lib/crm-functions.js");
  assert.equal(crmFunctions.length,6);
  assert.deepEqual(crmFunctions.map(g=>g.title),["Visão geral","Cadastros","Atendimento","Validações","Integrações","Evolução"]);
  const ids=crmFunctions.flatMap(group=>group.sections);
  assert.equal(ids.length,12);
  assert.equal(new Set(ids).size,12);
  assert.deepEqual(new Set(ids),new Set(crmSections.map(section=>section.id)));
  for(const id of ids)assert.ok(crmFunctionForSection(id));
});


test("Cada operação pertence a uma função e tem contrato, aceite e fonte",async()=>{
  const {crmFunctions}=await import("../lib/crm-functions.js");
  const {crmOperations,crmOperationIds,operationById,operationsByGroup}=await import("../lib/crm-operations.js");
  assert.equal(crmOperations.length,18);
  assert.equal(new Set(crmOperationIds).size,crmOperations.length);
  for(const op of crmOperations){
    assert.ok(crmFunctions.some(g=>g.id===op.group),op.id);
    assert.ok(op.objective.length>30,op.id);
    assert.ok(op.behavior.length>=2,op.id);
    assert.ok(op.inputs.length>=2,op.id);
    assert.ok(op.rules.length>=2,op.id);
    assert.ok(op.acceptance.length>=3,op.id);
    assert.ok(op.sources.every(s=>s.url.startsWith("https://github.com/delmacy/syndes-system/")),op.id);
    assert.ok(op.contract.method&&op.contract.http&&op.contract.permission&&op.contract.data,op.id);
    assert.ok(op.task.length>45,op.id);
    assert.equal(operationById(op.id),op);
    assert.ok(operationsByGroup(op.group).includes(op));
  }
});
test("Criar contato preserva contrato real e não afirma homologação",async()=>{
  const {operationById}=await import("../lib/crm-operations.js");
  const op=operationById("crm-create-person");
  assert.equal(op.contract.method,"CrmService.createPerson(context, input: CreatePerson)");
  assert.equal(op.contract.permission,"crm:people · write");
  assert.equal(op.contract.data,"crm_people, crm_audit");
  assert.match(op.state,/homologação pendente/);
  assert.ok(op.acceptance.some(a=>a.includes("tenant A")));
});


test("Inventário CRM cobre exatamente as rotas declaradas e mapeia todas às fichas",async()=>{
  const {readFileSync}=await import("node:fs");
  const {crmOperationIds}=await import("../lib/crm-operations.js");
  const routes=JSON.parse(readFileSync(new URL("../lib/crm-api-inventory.json",import.meta.url),"utf8"));
  const controller=readFileSync(new URL("../../../modules/core-crm/src/crm.controller.ts",import.meta.url),"utf8");
  const found=[...controller.matchAll(/@(Get|Post|Patch|Delete)\("([^"]+)"\)/g)]
    .map(m=>m[1].toUpperCase()+" /v1/tenants/:tenantId/crm/"+m[2]).sort();
  assert.equal(routes.length,30);
  assert.deepEqual(routes.map(r=>r.method+" "+r.path).sort(),found);
  for(const route of routes){
    assert.ok(crmOperationIds.includes(route.actionId),route.path);
    assert.match(route.permission,/^crm:/);
  }
});
test("Nove tabelas e seus campos têm fontes SQL versionadas e diagramas",async()=>{
  const {readFileSync}=await import("node:fs");
  const tables=JSON.parse(readFileSync(new URL("../lib/crm-data-inventory.json",import.meta.url),"utf8"));
  assert.equal(tables.length,9);
  assert.equal(new Set(tables.map(t=>t.table)).size,9);
  assert.equal(tables.reduce((n,t)=>n+t.columns.length,0),53);
  const diagrams=readFileSync(new URL("../../../docs/subprojects/P01-crm/DIAGRAMAS.md",import.meta.url),"utf8");
  assert.equal((diagrams.match(/```mermaid/g)||[]).length,6);
  for(const t of tables)assert.ok(diagrams.includes(t.table)||t.table==="crm_audit",t.table);
});

test("Recorte de cinco áreas mantém owners, ações distintas e fontes existentes",async()=>{
  const {PILOT_MODULES,PILOT_NAV,pilotModuleBySlug}=await import("../lib/pilot-modules.js");
  const {existsSync}=await import("node:fs");
  const {fileURLToPath}=await import("node:url");
  const {resolve}=await import("node:path");
  assert.deepEqual(PILOT_NAV.map(x=>x.slug),["crm","core-platform","blueprint","whatsapp","security","inbox","atendimentos"]);
  assert.equal(PILOT_MODULES.length,4);
  const allIds=PILOT_MODULES.flatMap(m=>m.actions.map(a=>a.id));
  assert.equal(new Set(allIds).size,allIds.length);
  for(const module of PILOT_MODULES){
    assert.equal(pilotModuleBySlug(module.slug),module);
    assert.ok(module.groups.length>=4);
    assert.ok(module.actions.length>=5);
    assert.equal(module.diagram.nodes.length,6);
    assert.ok(module.diagram.edges.length>=4);
    assert.match(module.state,/parcial|parciais|pendente|aprovado|revisão|aberto/i);
    for(const action of module.actions){
      assert.ok(module.groups.some(g=>g.id===action.area),action.id);
      for(const attr of ["objective","contract","data","api","security","tests","operation","risks"])assert.ok(action[attr].trim().length>0,action.id+" "+attr);
      assert.ok(action.sources.length>=2,action.id);
      for(const source of action.sources){
        assert.ok(source.url.startsWith("https://github.com/delmacy/syndes-system/blob/main/"),action.id);
        assert.ok(existsSync(resolve(fileURLToPath(new URL("../../..",import.meta.url)),source.path)),source.path);
      }
    }
  }
});


test("Diagramas do recorte são versionados e distinguem owners e gates",async()=>{
 const {readFileSync}=await import("node:fs");
 const raw=readFileSync(new URL("../../../docs/biblioteca/RECORTE-CINCO-AREAS.md",import.meta.url),"utf8");
 assert.equal((raw.match(/```mermaid/g)||[]).length,5);
 for(const word of ["Blueprint","Core Platform","WhatsApp","Keycloak","OpenFGA","OpenBao","aprovado"])assert.ok(raw.includes(word),word);
});


test("CRM oferece prompts separados de planejamento e execução sem aprovação implícita",async()=>{
 // O React JSX é validado no build/e2e; o contrato textual deve estar presente no componente.
 const {readFileSync}=await import("node:fs");
 const component=readFileSync(new URL("../components/operation-detail.jsx",import.meta.url),"utf8");
 assert.match(component,/crmWorkPrompt/);
 assert.match(component,/Sem decisão aprovada, não implemente/);
 assert.match(component,/Planejar alteração/);
});


test("Template Mestre cobre esferas completas sem exigir runtime onde não se aplica",async()=>{
  const {readFileSync,existsSync}=await import("node:fs");
  const {resolve,dirname}=await import("node:path");
  const {fileURLToPath}=await import("node:url");
  const standards=resolve(dirname(fileURLToPath(import.meta.url)),"../../../docs/standards");
  const read=name=>readFileSync(resolve(standards,name),"utf8");
  const main=read("TEMPLATE-FICHA-MODULO.md");
  const action=read("TEMPLATE-FICHA-ACAO.md");
  const guide=read("GUIA-FICHA-MODULO.md");
  assert.deepEqual([...main.matchAll(/^## (\d{2}) ·/gm)].map(x=>Number(x[1])),Array.from({length:22},(_,i)=>i));
  assert.deepEqual([...action.matchAll(/^## ([A-J])\./gm)].map(x=>x[1]),"ABCDEFGHIJ".split(""));
  for(const word of ["NÃO SE APLICA","PENDENTE DE VERIFICAÇÃO","código","tenant","organização","eventos","migrações","frontend","Segurança","WBS","decisão","diagramas","aceite","SHA"]){
    assert.match(main,new RegExp(word,"i"),"Ausência no template: "+word);
  }
  assert.ok((main.match(/```mermaid/g)||[]).length>=2);
  assert.ok((action.match(/```mermaid/g)||[]).length>=1);
  assert.ok(guide.includes("sem duplicar documentação"));
  for(const text of [main,action,guide]){
    for(const link of text.matchAll(/\]\(([^)#]+\.md)\)/g))assert.ok(existsSync(resolve(standards,link[1])),"Link ausente "+link[1]);
  }
});


test("Fichas CRM: 22 blocos, 18 ações A-J, 30 rotas e links consistentes",async()=>{
 const {readFileSync,existsSync}=await import("node:fs");
 const {resolve,dirname}=await import("node:path");
 const {fileURLToPath}=await import("node:url");
 const folder=resolve(dirname(fileURLToPath(import.meta.url)),"../../../docs/subprojects/P01-crm");
 const read=p=>readFileSync(resolve(folder,p),"utf8");
 const master=read("FICHA-MODULO.md"),matrix=read("MATRIZ-ACOES.md");
 const {crmOperations}=await import("../lib/crm-operations.js");
 const routes=JSON.parse(readFileSync(new URL("../lib/crm-api-inventory.json",import.meta.url),"utf8"));
 assert.deepEqual([...master.matchAll(/^## ([0-9]{2}) ·/gm)].map(m=>Number(m[1])),Array.from({length:22},(_,i)=>i));
 assert.equal(crmOperations.length,18);
 for(const operation of crmOperations){
   const path="acoes/"+operation.id+".md";
   assert.ok(existsSync(resolve(folder,path)),path);
   const doc=read(path);
   assert.deepEqual([...doc.matchAll(/^## ([A-J])[.] /gm)].map(m=>m[1]),"ABCDEFGHIJ".split(""));
   assert.match(doc,/edge cases/i);
   assert.match(doc,/NÃO HOMOLOGADOS/);
   assert.ok(matrix.includes("](acoes/"+operation.id+".md)"),path);
   assert.ok(doc.includes("../STATUS.md") && doc.includes("../FICHA-MODULO.md"));

 }
 assert.equal(routes.length,30);
 assert.ok(routes.every(r=>crmOperations.some(a=>a.id===r.actionId)));
 const component=readFileSync(new URL("../components/operation-detail.jsx",import.meta.url),"utf8");
 assert.match(component,/operation-action-dossier/);
 assert.match(component,/Ficha canônica/);
});


test("Ficha Mestre: CRM e P05 mantêm 22 blocos reais e cinco grupos independentes",async()=>{
 const {loadMasterDossier,MASTER_GROUPS,parseMasterMarkdown}=await import("../lib/master-dossiers.js");
 assert.equal(MASTER_GROUPS.length,5);
 assert.deepEqual(MASTER_GROUPS.flatMap(g=>g.numbers),Array.from({length:22},(_,i)=>String(i).padStart(2,"0")));
 for(const slug of ["crm","atendimentos"]){
  const doc=loadMasterDossier(slug);
  assert.equal(doc.sections.length,22,slug);
  assert.equal(doc.sections[0].number,"00");
  assert.equal(doc.sections.at(-1).number,"21");
  assert.ok(doc.sections.every(s=>s.body.length>75),slug);
  assert.match(doc.documentPath,/FICHA-MODULO[.]md$/);
 }
 assert.throws(()=>parseMasterMarkdown("## 00 · Incompleta"),/22 blocos/);
 assert.throws(()=>loadMasterDossier("modulo-inventado"),/fora do recorte/);
});

test("P05: matriz de 12 rotas vinculada ao controller sem homologação presumida",async()=>{
 const {readFileSync}=await import("node:fs");
 const {loadMasterDossier}=await import("../lib/master-dossiers.js");
 const doc=loadMasterDossier("atendimentos");
 const matrix=readFileSync(new URL("../../../docs/subprojects/P05-gestao-de-atendimentos/MATRIZ-ACOES.md",import.meta.url),"utf8");
 const code=readFileSync(new URL("../../../modules/service-management/src/controller.ts",import.meta.url),"utf8");
 const endpoints=[...code.matchAll(/@(Get|Post|Patch)\("([^"]+)"\)/g)].map(m=>m[1].toUpperCase()+" "+m[2]);
 assert.equal(endpoints.length,12);
 assert.equal(matrix.split("\n").filter(line=>line.startsWith("| `p05-")).length,12);
 for(const path of endpoints)assert.ok(matrix.includes("`"+path+"`"),path);
 assert.match(doc.sections[0].body,/NÃO HOMOLOGADOS/);
 assert.match(matrix,/PENDENTE/);
 assert.ok(!doc.sections.some(s=>s.body.includes("Product Gate aprovado")));
});


test("P02: 22 seções, sete funções, 19 fichas A-J e 17 rotas idênticas ao controller",async()=>{
 const {readFileSync,existsSync}=await import("node:fs");
 const {resolve}=await import("node:path");
 const {loadMasterDossier}=await import("../lib/master-dossiers.js");
 const {inboxActionCatalog,loadInboxAction,parseActionDossier}=await import("../lib/inbox-dossier.js");
 const base=resolve(new URL("../../../docs/subprojects/P02-inbox/",import.meta.url).pathname);
 const doc=loadMasterDossier("inbox");
 const catalog=inboxActionCatalog();
 assert.equal(doc.sections.length,22);
 assert.deepEqual(doc.sections.map(s=>s.number),Array.from({length:22},(_,i)=>String(i).padStart(2,"0")));
 assert.equal(catalog.groups.length,7);
 assert.equal(catalog.actions.length,19);
 assert.equal(new Set(catalog.actions.map(a=>a.id)).size,19);
 assert.equal(catalog.actions.filter(a=>a.verb).length,17);
 assert.equal(catalog.actions.filter(a=>!a.verb).length,2);
 const controller=readFileSync(resolve(base,"../../../modules/inbox/src/inbox.controller.ts"),"utf8");
 const found=[...controller.matchAll(/@(Get|Post|Patch)\("([^"]+)"\)/g)].map(m=>m[1].toUpperCase()+" "+m[2]).sort();
 const declared=catalog.actions.filter(a=>a.verb).map(a=>a.verb+" "+a.route).sort();
 assert.deepEqual(declared,found);
 const matrix=readFileSync(resolve(base,"MATRIZ-ACOES.md"),"utf8");
 for(const action of catalog.actions){
  const target=resolve(base,"acoes",action.id+".md");
  assert.ok(existsSync(target),target);
  const dossier=loadInboxAction(action.id);
  assert.deepEqual(dossier.sections.map(s=>s.letter),"ABCDEFGHIJ".split(""));
  assert.match(dossier.sections[2].body,/EC-01/);
  assert.match(dossier.sections[8].body,/CP-01/);
  assert.match(dossier.sections[0].body,/NÃO HOMOLOGADOS/);
  assert.ok(matrix.includes("](acoes/"+action.id+".md)"),action.id);
 }
 assert.throws(()=>parseActionDossier("## A. Apenas uma seção"),/A-J/);
 assert.throws(()=>loadInboxAction("p02-../../README"),/Invalid/);
 const refer=readFileSync(resolve(base,"REFERENCIA-TECNICA.md"),"utf8");
 assert.ok(refer.includes("17 rotas"));
 const status=readFileSync(resolve(base,"STATUS.md"),"utf8");
 assert.ok(status.includes("34 PASS")&&status.includes("não reexecutados"));
});


test("P02 reflete contratos HTTP, handlers, recursos FGA e exports do owner",async()=>{
 const {readFileSync}=await import("node:fs");
 const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");
 const catalog=JSON.parse(read("../../../docs/subprojects/P02-inbox/ACOES.json"));
 const controller=read("../../../modules/inbox/src/inbox.controller.ts");
 const plugin=read("../../../modules/inbox/src/plugin.ts");
 const manifest=JSON.parse(read("../../../modules/inbox/package.json"));
 const rows=[...controller.matchAll(/@(Get|Post|Patch)\("([^"]+)"\)\s*(?:async\s+)?([A-Za-z_]\w*)\s*\(/g)]
   .map(m=>({verb:m[1].toUpperCase(),route:m[2],handler:m[3]}))
   .sort((a,b)=>(a.verb+a.route).localeCompare(b.verb+b.route));
 const docs=catalog.actions.filter(a=>a.verb)
   .map(a=>({verb:a.verb,route:a.route,handler:a.controller}))
   .sort((a,b)=>(a.verb+a.route).localeCompare(b.verb+b.route));
 assert.deepEqual(docs,rows,"Endpoints ou handlers alterados: reconciliar fichas e catálogo");
 assert.equal(rows.length,17);
 assert.deepEqual(Object.keys(manifest.exports).sort(),[".","./plugin"]);
 const perms=[...plugin.matchAll(/\{resource:"([^"]+)",actions:\[([^\]]+)\]\}/g)].flatMap(m=>
   [...m[2].matchAll(/"([^"]+)"/g)].map(action=>m[1]+"/"+action[1]));
 const resources=new Set(perms);
 for(const a of catalog.actions.filter(a=>a.verb)){
   const used=[...a.permission.matchAll(/([a-z]+:[a-z]+)\/(read|write)/g)].map(m=>m[1]+"/"+m[2]);
   assert.ok(used.length,a.id+" permission unspecified");
   for(const resource of used){
     if(resource.startsWith("inbox:"))assert.ok(resources.has(resource),a.id+": "+resource+" not declared by plugin");
     else assert.ok(["crm:people/read","whatsapp:accounts/read"].includes(resource),a.id+": unexpected cross-owner grant");
   }
 }
 const master=read("../../../docs/subprojects/P02-inbox/FICHA-MODULO.md");
 assert.equal([...master.matchAll(/^## ([0-9]{2}) ·/gm)].length,22);
 assert.equal(catalog.actions.length,19);
 assert.equal(catalog.actions.filter(a=>!a.verb).length,2);
});

test("P02 paridade verifica migrations reais e divergência CRM manual vs consumer",async()=>{
 const {readFileSync}=await import("node:fs");
 const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");
 const base=read("../../../modules/inbox/sql/001_inbox_foundation.sql");
 assert.deepEqual([...base.matchAll(/CREATE TABLE IF NOT EXISTS (inbox_\w+)/g)].map(m=>m[1]).sort(),
   ["inbox_conversations","inbox_events","inbox_messages"]);
 const org2=read("../../../modules/organizations/sql/002_legacy_single_context_gate.sql");
 const org3=read("../../../modules/organizations/sql/003_legacy_ownership.sql");
 const wa5=read("../../../modules/whatsapp/sql/005_whatsapp_history.sql");
 const repo=read("../../../modules/inbox/src/postgres.ts");
 const consumer=read("../../../modules/inbox/src/crm-link-event-consumer.ts");
 const plugin=read("../../../modules/inbox/src/plugin.ts");
 const parity=read("../../../docs/subprojects/P02-inbox/PARIDADE-CODIGO.md");
 for(const col of ["platform_organization_id","platform_origin_workspace_id","platform_current_workspace_id"])
   assert.ok(org3.includes("ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS "+col),col);
 for(const col of ["is_group","unread_count","is_favorite","is_archived","history_sync_at"])
   assert.ok(wa5.includes("ADD COLUMN IF NOT EXISTS "+col),col);
 for(const col of ["source","bot_eligible","provider_message_id","provider_sender_id"])
   assert.ok(wa5.includes("ADD COLUMN IF NOT EXISTS "+col),col);
 for(const index of ["platform_legacy_single_organization","platform_legacy_single_workspace"])
   assert.ok(org2.includes(index),index);
 assert.ok(plugin.includes('id:"001_inbox_foundation"'));
 assert.ok(!plugin.includes('id:"005_whatsapp_history"'));
 const manual=repo.split("async linkContact(")[1].split("async append(")[0];
 assert.match(manual,/SET crm_person_id=\$3::uuid/);
 assert.ok(!manual.includes("crm_person_id IS NULL"),"manual link became conservative; update parity doc");
 assert.match(consumer,/FOR UPDATE/);
 assert.match(consumer,/crm_person_id IS NULL/);
 const readOp=repo.split("async markRead(")[1].split("async linkContact(")[0];
 assert.ok(!readOp.includes("inbox_events"),"read audit added: update parity doc");
 const favorite=repo.split("async favorite(")[1].split("async markRead(")[0];
 assert.match(favorite,/favorite_changed/);
 assert.ok(!favorite.includes("IS DISTINCT FROM"),"favorite no-op filter changed");
 for(const path of ["002_legacy_single_context_gate.sql","003_legacy_ownership.sql","005_whatsapp_history.sql",
  "crm_person_id IS NULL","markRead","favorite","43930160944"]){
   assert.ok(parity.includes(path),"Missing evidence in P02 parity: "+path);
 }
});

test("P02 assignment safety remains reflected in catalog and action dossier",async()=>{
 const {readFileSync}=await import("node:fs");
 const read=relative=>readFileSync(new URL(relative,import.meta.url),"utf8");
 const catalog=JSON.parse(read("../../../docs/subprojects/P02-inbox/ACOES.json"));
 const action=catalog.actions.find(a=>a.id==="p02-assignment-set");
 const source=read("../../../modules/inbox/src/postgres.ts");
 const doc=read("../../../docs/subprojects/P02-inbox/acoes/p02-assignment-set.md");
 const sql=source.split("async assign(tenantId:")[1].split("async status(")[0];
 for(const evidence of ["platform_org_memberships","platform_workspace_memberships","FOR SHARE OF c,o,w,om,wm","om.role IN ('admin','editor')","wm.role IN ('admin','editor')","assigned_to IS DISTINCT FROM"])
   assert.ok(sql.includes(evidence),"P02-ASSIGN-01 SQL drift: "+evidence);
 assert.match(doc,/P02-ASSIGN-01/);
 assert.match(doc,/não são corrigidos retroativamente/);
 assert.match(action.rules,/editor\/admin/);
 assert.ok(doc.includes("404 genérico")&&doc.includes("inbox:assignment/write"));
});
