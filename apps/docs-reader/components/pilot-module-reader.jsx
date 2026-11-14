"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ChevronRight, Network, ClipboardList, Code2, Copy, Download, CheckCircle2 } from "lucide-react";
import ProposalEditor from "./proposal-editor";
import { pilotModuleBySlug, PILOT_NAV } from "@/lib/pilot-modules";

const TABS=[["resumo","Resumo"],["fluxo","Fluxo"],["contratos","Contratos"],["dados","Dados"],["api","API"],["seguranca","Segurança"],["testes","Testes"],["operacao","Operação"],["pendencias","Pendências"]];
const github=(path)=>"https://github.com/delmacy/syndes-system/blob/main/"+path;
const segment=(value)=>String(value||"").replace(/[^a-z0-9-]/gi,"-");

function MiniDiagram({module}){
 const nodes=module.diagram.nodes;
 // Visual summary only: edges are derived from the editorial dependency map;
 // link targets and detailed evidence remain in each operation source.
 const positions=[[70,52],[305,52],[540,52],[70,155],[305,155],[540,155]];
 const lookup=i=>({x:positions[i][0],y:positions[i][1]});
 return <div className="pilot-diagram-scroll" role="region" aria-label={"Diagrama de "+module.title} tabIndex={0}>
   <svg width="100%" viewBox="0 0 760 265" role="img" aria-label={"Mapa de fronteiras de "+module.title} xmlns="http://www.w3.org/2000/svg">
     <title>Mapa de fronteiras de {module.title}</title><desc>Fluxos e dependências conceituais. Ligações não significam módulos instalados ou homologados.</desc>
     <defs><marker id={"pilot-arrow-"+module.slug} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="#567ca8"/></marker></defs>
     {module.diagram.edges.map(([a,b],i)=>{
       const x=lookup(a),y=lookup(b);const ax=x.x+82,ay=x.y+23,bx=y.x+82,by=y.y+23;
       const same=ay===by,dx=bx-ax,dy=by-ay;
       const sx=ax+(same?(dx>0?85:-85):0),sy=ay+(same?0:25),ex=bx+(same?(dx>0?-85:85):0),ey=by+(same?0:-25);
       return <line key={i} x1={sx} y1={sy} x2={ex} y2={ey} stroke="#7393bc" strokeWidth="1.6" markerEnd={"url(#pilot-arrow-"+module.slug+")"}/>;
     })}
     {nodes.map((label,i)=>{const {x,y}=lookup(i);return <g key={i}><rect x={x} y={y} width="165" height="46" rx="10" fill="#edf3fb" stroke="#b7cbe6"/><text x={x+82.5} y={y+27} fontSize="12" fontWeight="600" fill="#254e84" textAnchor="middle">{label}</text></g>})}
   </svg>
 </div>;
}
function promptFor(module,action,mode){
 const sources=action.sources.map(x=>"- "+x.path).join("\n");
 const planning=mode==="planning";
 return [
 "# SYNDES — "+(planning?"PLANEJAMENTO":"IMPLEMENTAÇÃO")+" FOCADO",
 "Área: "+module.title+" ("+module.code+")",
 "Grupo: "+module.groups.find(g=>g.id===action.area)?.title,
 "Ação: "+action.title+" ["+action.id+"]",
 "Status documental: "+module.state,
 "Objetivo: "+action.objective,
 "",
 "FONTES A CONSULTAR NO CHECKOUT ATUAL (verificar SHA e status):",sources,
 "",
 "EVIDÊNCIA E CONTRATO DECLARADOS:",action.contract,
 "DADOS: "+action.data,
 "API: "+action.api,
 "SEGURANÇA: "+action.security,
 "TESTES: "+action.tests,
 "OPERAÇÃO: "+action.operation,
 "PENDÊNCIAS: "+action.risks,
 "",
 "INSTRUÇÕES:",
 "1. Inspecione branch, SHA, AGENTS.md, requisitos, status e arquivos indicados; preserve mudanças de terceiros.",
 "2. Distinga planejamento, implementação, testes, deploy e aceite. Não invente capacidades.",
 planning
 ?"3. Analise impacto em contrato, API, dados, frontend, eventos, IAM, testes e diagramas. Proponha WBS pequena, critérios de aceite e decisões pendentes. NÃO altere código nem gates."
 :"3. Execute APENAS o requisito explicitamente aprovado anexado pelo proprietário. Sem aprovação ou critério de aceite, pare na análise; não implemente por inferência.",
 planning
 ?"4. Entregue diagnóstico, decisões necessárias, plano de execução e prompt de implementação focado. Não transforme proposta em aprovado."
 :"4. Execute testes afetados e atualize o documento da ação, as referências, diagramas, STATUS e WBS com SHA e evidências. Não execute migrations/deploy/grants sem autorização operacional.",
 "5. Fique no owner real; alterações transversais exigem justificativa e aprovação.",
 "",
 "OBSERVAÇÃO / DECISÃO DO PROPRIETÁRIO:",
 "[Cole aqui a observação exportada desta ação e, para implementação, o requisito aprovado e seu identificador.]",
 "",
 planning?"Saída: PROPOSTA para revisão, não autorização de execução.":"Saída: código, testes, docs, diferenças e bloqueios demonstráveis."
 ].join("\n");
}
function SourceLinks({sources}){
 return <div className="source-footer"><span className="source-label">Fontes canônicas verificáveis</span><div className="source-links">{sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noopener noreferrer">{s.label}<ArrowUpRight size={12}/></a>)}</div></div>;
}
function Detail({module,action}){
 const [tab,setTab]=useState("resumo"),[feedback,setFeedback]=useState("");
 const copy=async(mode)=>{const prompt=promptFor(module,action,mode);try{await navigator.clipboard.writeText(prompt);setFeedback("Prompt copiado. Inclua sua observação e a decisão aprovada quando aplicável.");}catch{setFeedback("Cópia bloqueada: utilize Exportar .md.");}};
 const download=(mode)=>{const data=promptFor(module,action,mode);const url=URL.createObjectURL(new Blob([data],{type:"text/markdown;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="syndes-"+segment(module.slug)+"-"+segment(action.id)+"-"+mode+".md";a.click();URL.revokeObjectURL(url);setFeedback("Prompt exportado em Markdown.");};
 return <div className="operation-detail pilot-operation" id={action.id} aria-labelledby="pilot-operation-title">
   <div className="operation-head"><div><span className="eyebrow">AÇÃO DOCUMENTAL · {module.code}</span><h3 id="pilot-operation-title">{action.title}</h3></div><span className="operation-status">{action.state}</span></div>
   <p className="operation-purpose">{action.objective}</p>
   <div className="operation-tablist" role="tablist" aria-label={"Assuntos de "+action.title}>
    {TABS.map(([id,label])=><button type="button" key={id} role="tab" id={"pilot-tab-"+id} aria-controls={"pilot-panel-"+id} aria-selected={tab===id} className={"operation-tab"+(tab===id?" active":"")} onClick={()=>setTab(id)}>{label}</button>)}
   </div>
   <div role="tabpanel" id={"pilot-panel-"+tab} aria-labelledby={"pilot-tab-"+tab} className="operation-tabpanel" tabIndex={0}>
    {tab==="resumo"&&<section className="operation-part"><h4>Objetivo e responsabilidade</h4><p>{action.objective}</p><p><strong>Owner:</strong> {module.ownership}</p><p><strong>Situação documental:</strong> {module.state}</p><p className="operation-evidence-note">A ficha é um recorte de leitura. Não representa implementação nova ou aceite.</p></section>}
    {tab==="fluxo"&&<section className="operation-part"><h4>Fluxo descrito nas fontes</h4><ol className="operation-steps">{action.flow.map((s,i)=><li key={i}>{s}</li>)}</ol><p className="operation-evidence-note">Fluxo lógico ou planejado; verificar gates antes de uso real.</p></section>}
    {tab==="contratos"&&<section className="operation-part"><h4>Interfaces e responsabilidades</h4><p>{action.contract}</p><p><strong>Fronteira:</strong> {module.ownership}</p></section>}
    {tab==="dados"&&<section className="operation-part"><h4>Dados e persistência</h4><p>{action.data}</p><p className="operation-evidence-note">Consultar schema real no owner; não executar DDL com base nesta página.</p></section>}
    {tab==="api"&&<section className="operation-part"><h4>API e métodos</h4><p>{action.api}</p><p>{action.contract}</p><p className="operation-evidence-note">Não deduzir endpoints adicionais ou disponibilidade operacional.</p></section>}
    {tab==="seguranca"&&<section className="operation-part"><h4>Segurança e escopo</h4><p>{action.security}</p><p className="operation-evidence-note">Validação no código e em ambiente autorizado é obrigatória antes do aceite.</p></section>}
    {tab==="testes"&&<section className="operation-part"><h4>Testes e critérios de prova</h4><p>{action.tests}</p><p className="operation-evidence-note">Testes descritos não significam testes executados nesta revisão.</p></section>}
    {tab==="operacao"&&<section className="operation-part"><h4>Estado e condições de operação</h4><p>{action.operation}</p><p className="operation-evidence-note">Não alterar containers, grants ou banco real como efeito de documentação.</p></section>}
    {tab==="pendencias"&&<section className="operation-part"><h4>Pendências e decisões</h4><p>{action.risks}</p><p>Registre a observação desta ação; exporte o rascunho para uso no prompt. Ele fica somente neste navegador.</p>
      <ProposalEditor moduleId={module.slug.toUpperCase()} sectionId={action.id} sectionTitle={action.title} sourceLink={action.sources[0]?.url||""}/>
      <div className="pilot-prompt-buttons">
       <button type="button" className="action-ghost" onClick={()=>copy("planning")}><ClipboardList size={14}/> Copiar prompt de planejamento</button>
       <button type="button" className="action-ghost" onClick={()=>copy("implementation")}><Code2 size={14}/> Copiar prompt de implementação</button>
       <button type="button" className="action-ghost" onClick={()=>download("planning")}><Download size={14}/> Exportar planejamento .md</button>
       <button type="button" className="action-ghost" onClick={()=>download("implementation")}><Download size={14}/> Exportar implementação .md</button>
      </div>
      {feedback&&<p role="status" className="proposal-feedback">{feedback}</p>}
     </section>}
   </div>
   <SourceLinks sources={action.sources}/>
 </div>;
}
export default function PilotModuleReader({slug}){
 const module=pilotModuleBySlug(slug);
 const [selected,setSelected]=useState(0),[groupId,setGroupId]=useState(module?.groups[0]?.id||""),[mode,setMode]=useState("action");
 const actions=module?.actions.filter(a=>a.area===groupId)||[];
 const selectedAction=module?.actions[selected]||module?.actions[0];
 useEffect(()=>{
  const sync=()=>{const id=decodeURIComponent(window.location.hash.slice(1));const found=module.actions.findIndex(a=>a.id===id);if(found>=0){setSelected(found);setGroupId(module.actions[found].area);setMode("action");}else if(id==="overview-"+slug){setMode("overview");}};
  sync();window.addEventListener("hashchange",sync);window.addEventListener("popstate",sync);
  return ()=>{window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync);};
 },[slug,module]);
 const choose=(a)=>{setSelected(module.actions.indexOf(a));setGroupId(a.area);setMode("action");window.history.pushState(null,"","#"+a.id)};
 const chooseGroup=(g)=>{setGroupId(g.id);const a=module.actions.find(a=>a.area===g.id);if(a)choose(a);};
 if(!module)return null;
 return <div className="module-layout">
  <aside className="module-sidebar" aria-label={"Funções de "+module.title}>
   <div className="side-top">EXPLORAR · {module.title.toUpperCase()}</div>
   <Link href="/" className="sidebar-home"><ArrowLeft size={14}/> Biblioteca</Link>
   <nav aria-label={"Funções de "+module.title} className="function-side-nav">{module.groups.map(g=><button type="button" className={"function-side-button"+(groupId===g.id?" active":"")} key={g.id} onClick={()=>chooseGroup(g)} aria-current={groupId===g.id?"page":undefined}><span>{g.title}</span><small>{module.actions.filter(a=>a.area===g.id).length} ações</small></button>)}</nav>
   <div className="function-side-context"><span className="side-group">AÇÕES DA FUNÇÃO</span>{actions.map(a=><button type="button" key={a.id} className={"side-link operation-side-link"+(mode==="action"&&selectedAction.id===a.id?" active":"")} onClick={()=>choose(a)}>{a.title}</button>)}
   <button type="button" className={"side-link reference-side-link"+(mode==="overview"?" active":"")} onClick={()=>{setMode("overview");window.history.pushState(null,"","#overview-"+slug)}}><Network size={14}/> Mapa e fontes gerais</button></div>
  </aside>
  <article className="module-main">
   <header className="module-hero"><span className="eyebrow">BIBLIOTECA SYNDES · {module.code}</span><h1 className="serif-title">{module.title}.</h1><p className="subtitle">{module.subtitle}</p><p className="module-summary">{module.intro}</p><div className="module-status"><span className="status-pill">{module.state}</span><span>{module.groups.length} funções · {module.actions.length} ações de leitura</span></div></header>
   <nav className="function-tabs" aria-label={"Funções de "+module.title}>{module.groups.map(g=><button className={"function-tab"+(groupId===g.id?" active":"")} type="button" key={g.id} onClick={()=>chooseGroup(g)}>{g.title}<span className="function-tab-count">{module.actions.filter(a=>a.area===g.id).length}</span></button>)}</nav>
   <section className="function-intro"><span className="eyebrow">RECORTE DE TRABALHO</span><h2>{module.groups.find(g=>g.id===groupId)?.title}</h2><p>{module.groups.find(g=>g.id===groupId)?.description}</p><div className="operation-selector" aria-label="Selecionar ação">{actions.map(a=><button className={"operation-choice"+(mode==="action"&&selectedAction.id===a.id?" active":"")} key={a.id} type="button" onClick={()=>choose(a)}><span><small>DOCUMENTAÇÃO</small><strong>{a.title}</strong></span><ChevronRight size={17}/></button>)}</div><button type="button" className="reference-mode-button" onClick={()=>setMode("overview")}><Network size={15}/> Mapa e fontes do módulo</button></section>
   {mode==="action"&&<Detail key={selectedAction.id} module={module} action={selectedAction}/>}
   {mode==="overview"&&<section className="pilot-overview" aria-label={"Mapa e referências de "+module.title}><span className="eyebrow">ARQUITETURA E DEPENDÊNCIAS</span><h2>Mapa de {module.title}</h2><p>{module.ownership}</p><MiniDiagram module={module}/><p><a href={github("docs/biblioteca/RECORTE-CINCO-AREAS.md")} target="_blank" rel="noopener noreferrer">Abrir diagramas Mermaid e decisões da fase <ArrowUpRight size={12} style={{display:"inline"}}/></a></p><p className="operation-evidence-note">Diagrama conceitual: representa fronteiras lógicas, não uma topologia implantada ou homologação. As fontes canônicas estão abaixo.</p><SourceLinks sources={module.sources}/></section>}
   <div className="endnote">A Biblioteca organiza decisões por função e ação. Os documentos de escopo e STATUS continuam sendo as fontes vigentes; registrar comentário não equivale a aprová-lo. Para planejar ou implementar, use a aba <strong>Pendências</strong> da ação selecionada.</div>
  </article>
 </div>;
}
