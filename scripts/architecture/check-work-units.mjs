import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const data = JSON.parse(readFileSync(resolve(root,'catalog/work-units.json'),'utf8'));
const counts = {P:14,A:8,C:8,I:12,Q:10,G:5};
const fronts = ['produto','plataforma','frontend','qualidade','operacao'];
assert.equal(data.schema_version,1);
assert.deepEqual(data.fronts.map(x=>x.id),fronts);
assert.equal(data.units.length,57);
const ids=new Set();
for(const u of data.units){
 assert.match(u.id,/^[PACIQG][0-9]{2}$/);
 assert.ok(!ids.has(u.id),'duplicate '+u.id); ids.add(u.id);
 assert.ok(fronts.includes(u.front),'unknown front '+u.id);
 assert.ok(u.name && typeof u.name==='string');
 assert.ok(u.path && typeof u.path==='string' && !isAbsolute(u.path) && !u.path.split('/').includes('..'));
 const p=resolve(root,u.path);
 assert.ok(p.startsWith(root+'/') && existsSync(p),'missing path '+u.id+': '+u.path);
 assert.ok(['code','contract','distributed','verified','partial','unverified'].includes(u.maturity));
 if(u.id.startsWith('P')){
  assert.ok(existsSync(resolve(p,'AGENTS.md')),'missing module AGENTS '+u.id);
  if(u.maturity==='code') assert.ok(existsSync(resolve(p,'package.json')),'missing package '+u.id);
 }
}
for(const [prefix,count] of Object.entries(counts)) for(let i=1;i<=count;i++) assert.ok(ids.has(prefix+String(i).padStart(2,'0')));
console.log('Work-unit repository map: PASS ('+data.units.length+' units)');
