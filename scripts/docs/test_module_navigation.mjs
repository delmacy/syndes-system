import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {runInNewContext} from "node:vm";
import test from "node:test";

const root=join(dirname(fileURLToPath(import.meta.url)),"../..");
const source=readFileSync(join(root,"docs/assets/module-nav.js"),"utf8");
const base="https://delmacy.github.io/syndes-system/subprojects/P01-crm/";

function openAt(path) {
  const redirected=[];
  const tabs=["APIS","DADOS","CONTRATOS","CODIGO","DEPENDENCIAS","TESTES","ESCOPO"]
    .map(name=>({href:base+name+"/",current:false,
      setAttribute(k,v){if(k==="aria-current")this.current=v==="page";},
      removeAttribute(k){if(k==="aria-current")this.current=false;}}));
  const document={readyState:"complete",querySelector(selector){
    return selector===".syndes-module-tabs"?{querySelectorAll:()=>tabs}:null;
  }};
  const location={href:base+path,replace(url){redirected.push(url);}};
  runInNewContext(source,{document,window:{location,addEventListener(){}},URL});
  return {redirected,tabs};
}

test("legacy HTTP anchor redirects to isolated APIS page",()=>{
  const result=openAt("REFERENCIA-TECNICA/#endpoints-http");
  assert.deepEqual(result.redirected,[base+"APIS/"]);
});
test("legacy SQL and contracts anchors redirect only to their subject",()=>{
  assert.deepEqual(openAt("REFERENCIA-TECNICA/#schemas-sql").redirected,[base+"DADOS/"]);
  assert.deepEqual(openAt("REFERENCIA-TECNICA/#pacote-publico").redirected,[base+"CONTRATOS/"]);
  assert.deepEqual(openAt("REFERENCIA-TECNICA/#dependencias-declaradas").redirected,[base+"DEPENDENCIAS/"]);
});
test("standalone page selects matching tab and does not redirect",()=>{
  const result=openAt("APIS/");
  assert.deepEqual(result.redirected,[]);
  assert.equal(result.tabs.filter(x=>x.current).length,1);
  assert.equal(result.tabs.find(x=>x.current).href,base+"APIS/");
});
test("legacy full reference without section hash remains available",()=>{
  assert.deepEqual(openAt("REFERENCIA-TECNICA/").redirected,[]);
});
