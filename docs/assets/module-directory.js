/* Human catalog powered only by our static generated index, no token/API runtime. */
(function () {
  "use strict";
  const host=document.getElementById("syndes-catalog");
  if(!host)return;
  const input=host.querySelector("#syndes-catalog-search");
  const select=host.querySelector("#syndes-catalog-area");
  const state=host.querySelector(".syndes-catalog-state");
  const results=host.querySelector(".syndes-catalog-results");
  const names={produto:"Produto",operacao:"Operação",plataforma:"Plataforma",frontend:"Frontend",infraestrutura:"Infraestrutura",qualidade:"Qualidade"};
  const label=(m)=>m.id.startsWith("I")?"infraestrutura":m.area;
  const link=(href,title)=>{
    const a=document.createElement("a");a.href=href;a.textContent=title;
    a.setAttribute("rel","noopener");return a;
  };
  let modules=[];
  const incoming=new URLSearchParams(window.location.search);
  if(incoming.has("q"))input.value=incoming.get("q").slice(0,100);
  if(incoming.has("area")&&[...select.options].some(x=>x.value===incoming.get("area")))select.value=incoming.get("area");
  function render(){
    const q=input.value.trim().toLocaleLowerCase("pt-BR");
    const area=select.value;
    const filtered=modules.filter(m=>{
      if(m.documentationParent)return false;
      if(area&&label(m)!==area)return false;
      return !q||[m.id,m.name,m.source,names[label(m)]].join(" ").toLocaleLowerCase("pt-BR").includes(q);
    });
    state.textContent=filtered.length+" módulos visíveis · "+modules.length+" unidades rastreadas · declarações de código (não homologação)";
    results.replaceChildren();
    for(const m of filtered){
      const card=document.createElement("article");card.className="syndes-catalog-entry";
      const heading=document.createElement("h3");
      heading.append(link(m.home,m.id+" · "+m.name));
      card.append(heading);
      const sub=document.createElement("p");sub.className="syndes-catalog-meta";
      sub.textContent=names[label(m)]+" · "+m.source+" · "+m.symbolCount+" tipos / "+m.methodCount+" métodos identificados";
      card.append(sub);
      const links=document.createElement("div");links.className="syndes-catalog-links";
      for(const [key,title] of [["capabilities","Capacidades"],["stack","Stack"],["publicContracts","Contrato público"],["privateMethods","Classes e métodos"],["http","APIs"],["frontend","Frontend"],["database","Banco"],["workpackages","Evolução"]]){
        links.append(link(m.anchors[key],title));
      }
      card.append(links);results.append(card);
    }
    if(filtered.length===0){const p=document.createElement("p");p.textContent="Nenhum módulo encontrado. Pesquise por ID (ex.: P03), nome ou caminho.";results.append(p);}
  }
  const url=new URL("../../assets/catalog/modules.json",window.location.href);
  fetch(url,{cache:"no-cache"}).then(r=>{if(!r.ok)throw Error("status "+r.status);return r.json();}).then(data=>{
    if(!data||!Array.isArray(data.modules))throw Error("formato inválido");
    modules=data.modules;render();
  }).catch(()=>{state.textContent="Índice indisponível neste momento. Use a navegação à esquerda ou a busca do MkDocs.";});
  input.addEventListener("input",render);
  select.addEventListener("change",render);
})();