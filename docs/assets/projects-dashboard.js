/* Read-only WBS associations, never invented progress percentages. */
(() => {
  "use strict";
  const host = document.getElementById("syndes-projects");
  if (!host) return;
  const search=host.querySelector("#syndes-projects-search");
  const area=host.querySelector("#syndes-projects-area");
  const results=host.querySelector(".syndes-projects-results");
  const state=host.querySelector(".syndes-projects-state");
  const count=host.querySelector(".syndes-projects-unit-count");
  const tasks=host.querySelector(".syndes-projects-task-count");
  const source=host.querySelector(".syndes-projects-source");
  let modules=[];
  const node=(tag,cls,label)=>{
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(label!==undefined)n.textContent=label;
    return n;
  };
  const link=(href,label)=>{
    const a=node("a","",label);
    a.href=href;a.rel="noopener";
    return a;
  };
  const norm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  function render() {
    const q=norm(search.value.trim()), group=area.value;
    const filtered=modules.filter(mod=>(!group||mod.area===group)&&
      (!q||norm([mod.id,mod.name,mod.area,...mod.taskIds].join(" ")).includes(q)));
    state.textContent=filtered.length+" unidades exibidas · associações documentais, não status em tempo real";
    results.replaceChildren();
    for (const mod of filtered) {
      const card=node("article","syndes-project-card");
      const top=node("div","syndes-project-top");
      const h=node("h3");h.append(link(mod.links.module,mod.id+" · "+mod.name));
      top.append(h,node("span","syndes-project-area",mod.area));
      const summary=node("p","syndes-project-counts",
        mod.workpackageIds.length+" grupos WBS relacionados · "+mod.taskIds.length+" tarefas associadas");
      const ids=node("div","syndes-project-ids");
      ids.append(node("span","","IDs vinculados: "));
      ids.append(node("code","",mod.taskIds.length?mod.taskIds.join(", "):"nenhum vínculo cadastrado"));
      const actions=node("div","syndes-project-actions");
      for (const [key,label] of [["wbs","WBS e workpackages"],["sprint","Sprint"],["status","Status e bloqueios"],["history","Commits"],["issues","Issues"]])
        actions.append(link(mod.links[key],label));
      card.append(top,summary,ids,actions);
      if(mod.relatedPlans.length){
        const extra=node("div","syndes-project-plans");
        extra.append(node("span","","Planos técnicos relacionados: "));
        for (const p of mod.relatedPlans){
          extra.append(link(p.url,p.path.split("/").at(-1).replace(".md","")));
        }
        card.append(extra);
      }
      results.append(card);
    }
    if(!filtered.length)results.append(node("p","syndes-project-empty","Nenhuma unidade corresponde aos filtros."));
  }
  fetch(new URL("../../assets/catalog/projects.json",window.location.href),{cache:"no-store"})
    .then(r=>{if(!r.ok)throw Error("WBS registry HTTP "+r.status);return r.json()})
    .then(data=>{
      if(!data||!Array.isArray(data.units)||data.state!=="planning-associations-only")throw Error("unexpected registry");
      modules=data.units;
      count.textContent=String(modules.length);
      tasks.textContent=String(new Set(modules.flatMap(x=>x.taskIds)).size);
      source.textContent="WBS";
      [...new Set(modules.map(x=>x.area))].sort().forEach(name=>{
        const opt=node("option","",name);opt.value=name;area.append(opt);
      });
      render();
    }).catch(()=>{state.textContent="Registro da WBS indisponível; use os links documentais abaixo.";});
  search.addEventListener("input",()=>{if(modules.length)render()});
  area.addEventListener("change",()=>{if(modules.length)render()});
})();
