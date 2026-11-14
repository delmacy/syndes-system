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
  assert.deepEqual(PILOT_NAV.map(x=>x.slug),["crm","core-platform","blueprint","whatsapp","security"]);
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
