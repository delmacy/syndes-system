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
