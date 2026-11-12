/* Read-only GitHub Actions dashboard. Never collect credentials or use tokens. */
(() => {
  "use strict";
  const API = "https://api.github.com/repos/delmacy/syndes-system/actions/workflows/";
  const WORKFLOWS = [
    {name:"Documentação · GitHub Pages",file:"syndes-docs-pages.yml",description:"Compilação e publicação do Syndes Docs"},
    {name:"CI principal",file:"syndes-ci.yml",description:"Validação de integridade e regressões da main"},
    {name:"Support Browser E2E",file:"support-browser-e2e.yml",description:"Verificações especializadas de suporte"},
    {name:"Platform Manager",file:"platform-manager.yml",description:"Verificações especializadas da plataforma"}
  ];
  const TEXT = {
    success: "Sucesso", failure: "Falha", cancelled: "Cancelado",
    skipped: "Ignorado", timed_out: "Tempo esgotado", action_required: "Ação necessária",
    neutral: "Neutro", stale: "Desatualizado", pending:"Pendente"
  };
  let loadedFor = null;
  function node(tag, className, text) {
    const n=document.createElement(tag);
    if(className)n.className=className;
    if(text!==undefined)n.textContent=text;
    return n;
  }
  function ts(value) {
    if (!value) return "Data indisponível";
    const time=new Date(value);
    if(Number.isNaN(time.getTime()))return "Data indisponível";
    return new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(time);
  }
  async function readWorkflow(item) {
    const url=API+encodeURIComponent(item.file)+"/runs?branch=main&per_page=1";
    const response=await fetch(url,{headers:{"Accept":"application/vnd.github+json"},cache:"no-store"});
    if(!response.ok)throw new Error(response.status===403?"Limite de consultas do GitHub":"HTTP "+response.status);
    const result=await response.json();
    return Array.isArray(result.workflow_runs)?result.workflow_runs[0]||null:null;
  }
  function renderCard(item,result) {
    const card=node("article","syndes-workflow-card");
    const title=node("h3","",item.name);
    const description=node("p","",item.description);
    const state=result.status==="fulfilled"?(result.value?result.value.conclusion||result.value.status:"no_run"):"error";
    const words=state==="no_run"?"Nenhuma execução":state==="error"?"Indisponível":TEXT[state]||({in_progress:"Em execução",queued:"Na fila",waiting:"Aguardando"}[state]||state);
    const badge=node("span","syndes-workflow-state",words);
    badge.dataset.state=state;
    const detail=node("p","syndes-workflow-date",state==="error"?(result.reason?.message||"Consulta indisponível"):
      result.value?(ts(result.value.updated_at||result.value.created_at)+" · "+(result.value.head_sha||"").slice(0,8)):"Sem execução encontrada");
    const link=node("a","syndes-workflow-link","Ver execução no GitHub ↗");
    const href=result.status==="fulfilled"&&result.value?.html_url
      ?result.value.html_url
      :"https://github.com/delmacy/syndes-system/actions/workflows/"+item.file;
    link.href=href;
    link.target="_blank";
    link.rel="noopener noreferrer";
    card.append(title,badge,description,detail,link);
    return card;
  }
  async function load() {
    const root=document.getElementById("syndes-workflow-dashboard");
    if(!root||root.dataset.loading==="yes")return;
    root.dataset.loading="yes";
    root.textContent="";
    const toolbar=node("div","syndes-workflows-toolbar");
    const info=node("span","syndes-workflow-meta","Consultando os workflows da branch main…");
    const button=node("button","syndes-topic-button","Atualizar estados");
    button.type="button";
    button.disabled=true;
    button.addEventListener("click",load);
    toolbar.append(info,button);
    const grid=node("div","syndes-workflows-grid");
    root.append(toolbar,grid);
    const marker = document.querySelector(".syndes-source-marker[data-doc-revision]");
    const builtSha = marker?.dataset.docRevision;
    if (builtSha && /^[0-9a-f]{40}$/.test(builtSha)) {
      const buildInfo = node("p", "syndes-workflow-meta", "Este site foi compilado a partir do commit ");
      const refLink = node("a", "", builtSha.slice(0,8) + " ↗");
      refLink.href = "https://github.com/delmacy/syndes-system/commit/" + builtSha;
      refLink.target = "_blank";
      refLink.rel = "noopener noreferrer";
      buildInfo.appendChild(refLink);
      root.appendChild(buildInfo);
    }
    try {
      const results=await Promise.allSettled(WORKFLOWS.map(readWorkflow));
      for(let i=0;i<WORKFLOWS.length;i++)grid.append(renderCard(WORKFLOWS[i],results[i]));
      info.textContent="Consulta pública realizada em "+ts(new Date().toISOString())+" · Horário local";
    } finally {
      root.dataset.loading="no";
      button.disabled=false;
    }
  }
  function init() {
    const root=document.getElementById("syndes-workflow-dashboard");
    if(!root)return;
    if(loadedFor===root)return;
    loadedFor=root;
    load();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
  if(typeof document$!=="undefined"&&document$.subscribe)document$.subscribe(init);
})();
