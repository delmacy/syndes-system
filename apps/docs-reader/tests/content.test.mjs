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

test("Cada um dos 12 tópicos tem inventário técnico com fontes verificáveis", async()=>{
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
      for(const source of block.references)assert.match(source.href,/^https:\\/\\/github\\.com\\/delmacy\\/syndes-system\\//);
    }
  }
});

test("Exemplos operacionais nao equivalem a homologacao", async()=>{
  const {CRM_EVIDENCE}=await import("../lib/crm-evidence.js");
  const all=Object.values(CRM_EVIDENCE).flatMap(e=>e.blocks).flatMap(b=>b.rows).flat().join(" ");
  assert.match(all,/b452a03e/);
  assert.match(all,/29 PASS/);
  assert.match(all,/Product Gate/);
  assert.match(all,/crm_people/);
  assert.match(all,/CrmService/);
  assert.match(all,/crm:people/);
  assert.match(all,/inbox\\.participant\\.observed\\.v1/);
  assert.match(all,/50\\.02/);
});
