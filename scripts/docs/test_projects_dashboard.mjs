import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {runInNewContext} from "node:vm";
import test from "node:test";

const root=join(dirname(fileURLToPath(import.meta.url)),"../..");
const src=readFileSync(join(root,"docs/assets/projects-dashboard.js"),"utf8");
class El {
  constructor(tag="div"){this.tag=tag;this.children=[];this.textContent="";this.value="";this.handlers={};}
  append(...xs){this.children.push(...xs);}
  replaceChildren(...xs){this.children=xs;}
  addEventListener(type,fn){this.handlers[type]=fn;}
  dispatch(type){this.handlers[type]?.();}
}
test("projects panel filters documented WBS tasks without computing fabricated completion",async()=>{
  const search=new El("input"),area=new El("select"),results=new El(),state=new El();
  const unitCount=new El(),taskCount=new El(),source=new El();
  const refs={
    "#syndes-projects-search":search,"#syndes-projects-area":area,
    ".syndes-projects-results":results,".syndes-projects-state":state,
    ".syndes-projects-unit-count":unitCount,".syndes-projects-task-count":taskCount,
    ".syndes-projects-source":source
  };
  const host={querySelector:key=>refs[key]};
  const data={state:"planning-associations-only",units:[
    {id:"P03",name:"WhatsApp",area:"Canais e comunicações",taskIds:["50.05","50.08"],
     workpackageIds:["50"],relatedPlans:[],links:{module:"/p03/",wbs:"/p03/EVOLUCAO/",
       sprint:"/p03/SPRINT/",status:"/p03/STATUS/",history:"/p03/HISTORICO/",issues:"/issues/?P03"}},
    {id:"P02",name:"Inbox",area:"Atendimento",taskIds:["50.08","50.03"],
     workpackageIds:["50"],relatedPlans:[],links:{module:"/p02/",wbs:"/p02/EVOLUCAO/",
       sprint:"/p02/SPRINT/",status:"/p02/STATUS/",history:"/p02/HISTORICO/",issues:"/issues/?P02"}}
  ]};
  const ctx={document:{getElementById:id=>id==="syndes-projects"?host:null,createElement:tag=>new El(tag)},
    window:{location:{href:"https://example.org/blueprint/PROJETOS/"}},
    URL,fetch:async()=>({ok:true,json:async()=>data})};
  runInNewContext(src,ctx);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(results.children.length,2);
  assert.equal(unitCount.textContent,"2");
  assert.equal(taskCount.textContent,"3"); // 50.08 deduplicated
  assert.match(results.children[0].children[1].textContent,/2 tarefas/);
  assert.equal(results.children[0].children[3].children[0].href,"/p03/EVOLUCAO/");
  search.value="50.03";search.dispatch("input");
  assert.equal(results.children.length,1);
  search.value="";area.value="Canais e comunicações";area.dispatch("change");
  assert.equal(results.children.length,1);
  assert.match(state.textContent,/associações documentais/);
  assert.equal(results.children[0].children.some(x=>x.textContent?.includes("72%")),false);
});
