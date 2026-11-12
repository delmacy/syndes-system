import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const root=join(dirname(fileURLToPath(import.meta.url)), '../..');
const source=readFileSync(join(root,'docs/assets/topic-editor.js'),'utf8');
const context={document:{readyState:'loading',addEventListener(){}},window:{},navigator:{},URL};
const instrumented=source.replace(/\}\)\(\);\s*$/, 'globalThis.__test = { makeProjectionPrompt, makeQuickChangePrompt, createIssueBody, pageMetadata };})();');
assert.notEqual(instrumented,source,'Test access point must be installed');
runInNewContext(instrumented,context);
const editor=context.__test;
const metadata={source:'docs/subprojects/P02-inbox/chapters/03-capabilities.md',revision:'a'.repeat(40)};
const section={heading:'3. Capabilities',level:2,position:1,markdown:'## 3. Capabilities\n- Existente\n'};

test('proposal prompt is scoped to the Inbox chapter and leaves implementation gated',()=>{
 const s=editor.makeProjectionPrompt(section,metadata,'nova_capacidade','Quero uma nova capacidade X');
 for(const path of [
   'docs/subprojects/P02-inbox/PROJECAO.md',
   'docs/subprojects/P02-inbox/chapters/03-capabilities.md',
   'docs/subprojects/P02-inbox/updates/'
 ]) assert.ok(s.includes(path),path);
 assert.ok(s.includes('Quero uma nova capacidade X'));
 assert.ok(s.includes('NÃO implemente código'));
 assert.ok(s.includes('Após minha aprovação'));
});

test('issue body includes source SHA, module, original and proposed text',()=>{
 const text=editor.createIssueBody(section,metadata,'nova_capacidade','Quero capacidade X');
 for(const x of ['P02','03-capabilities.md','a'.repeat(40),'Quero capacidade X','Existente','PROPOSTA'])assert.ok(text.includes(x),x);
});

test('short alteration prompt includes only the module, exact topic and change',()=>{
 const s=editor.makeQuickChangePrompt(section,metadata,'Ajuste o filtro da Inbox');
 for(const text of ['P02','docs/subprojects/P02-inbox/ALTERACAO.md','03-capabilities.md','Ajuste o filtro da Inbox']) {
   assert.ok(s.includes(text),text);
 }
 assert.ok(s.includes('não implemente'));
 assert.ok(s.length<1500,'Alteration prompt must remain concise');
});

test('generated technical topics become source-change proposals, not edits to derived Markdown',()=>{
 const section={heading:'APIs registradas',level:3,position:0,markdown:'Inventário gerado do código',generated:true,codeSource:'modules/whatsapp'};
 const body=editor.createIssueBody(section,metadata,'melhoria','Revisar contrato HTTP');
 assert.ok(body.includes('Seção gerada'),body);
 assert.ok(body.includes('modules/whatsapp'));
 assert.ok(body.includes('não editar o Markdown gerado'));
});

test('generated subject view resolves its own metadata while preserving canonical edit source',()=>{
 const marker={dataset:{
   docSource:'docs/subprojects/P01-crm/REFERENCIA-TECNICA.md',
   docRevision:'a'.repeat(40),
   docSections:'../APIS.sections.json'
 }};
 context.document.querySelector=()=>marker;
 context.window.location={href:'https://delmacy.github.io/syndes-system/subprojects/P01-crm/APIS/'};
 const m=editor.pageMetadata();
 assert.equal(m.source,marker.dataset.docSource);
 assert.equal(m.sectionsUrl,'https://delmacy.github.io/syndes-system/subprojects/P01-crm/APIS.sections.json');
 marker.dataset.docSections='../../../../bad.json';
 assert.equal(editor.pageMetadata(),null,'External/traversal sections path must be rejected');
});
