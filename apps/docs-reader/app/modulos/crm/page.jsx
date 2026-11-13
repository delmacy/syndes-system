"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Heading, Text } from "@chakra-ui/react";
import { ArrowLeft, ArrowUpRight, BookOpenText, ChevronRight, FileCode2 } from "lucide-react";
import SiteShell from "@/components/site-shell";
import ReadingSection from "@/components/reading-section";
import OperationDetail from "@/components/operation-detail";
import { crmSections, CRM } from "@/lib/content";
import { crmFunctions, crmFunctionForSection } from "@/lib/crm-functions";
import { crmOperations, operationById, operationsByGroup } from "@/lib/crm-operations";

const byId=new Map(crmSections.map(section=>[section.id,section]));
const firstFor=(groupId)=>{
  const op=operationsByGroup(groupId)[0];
  return op?{groupId,mode:"operation",id:op.id}:{groupId,mode:"reference",id:crmFunctions.find(g=>g.id===groupId)?.sections[0]||"identificacao"};
};
function stateFromHash(){
  if(typeof window==="undefined")return firstFor(crmFunctions[0].id);
  const id=decodeURIComponent(window.location.hash.slice(1));
  const op=operationById(id);
  if(op)return {groupId:op.group,mode:"operation",id:op.id};
  const group=crmFunctionForSection(id);
  if(group)return {groupId:group.id,mode:"reference",id};
  const standalone=crmFunctions.find(g=>g.id===id);
  return firstFor(standalone?.id||crmFunctions[0].id);
}
export default function CrmPage(){
  const [reader,setReader]=useState(()=>firstFor(crmFunctions[0].id));
  useEffect(()=>{
    const sync=()=>setReader(stateFromHash());
    sync();
    window.addEventListener("hashchange",sync);
    window.addEventListener("popstate",sync);
    return ()=>{
      window.removeEventListener("hashchange",sync);
      window.removeEventListener("popstate",sync);
    };
  },[]);
  const group=crmFunctions.find(item=>item.id===reader.groupId)||crmFunctions[0];
  const operations=operationsByGroup(group.id);
  const navigate=(next,scrollTarget="selected-function-heading")=>{
    setReader(next);
    if(window.location.hash!=="#"+next.id)window.history.pushState(null,"","#"+next.id);
    window.requestAnimationFrame(()=>document.getElementById(scrollTarget)?.scrollIntoView({behavior:"smooth",block:"start"}));
  };
  const switchGroup=(id)=>navigate(firstFor(id));
  const switchOperation=(id)=>{
    const op=operationById(id);
    if(op)navigate({groupId:op.group,mode:"operation",id},"operation-reader-anchor");
  };
  const switchReference=(id)=>{
    const g=crmFunctionForSection(id);
    if(g)navigate({groupId:g.id,mode:"reference",id},"reference-reader-anchor");
  };
  const selectedOperation=reader.mode==="operation"?operationById(reader.id):null;
  return <SiteShell>
    <div className="module-layout">
      <aside className="module-sidebar" aria-label="Funções do CRM">
        <div className="side-top">EXPLORAR O CRM</div>
        <Link href="/" className="sidebar-home"><ArrowLeft size={14}/> Visão da plataforma</Link>
        <nav aria-label="Funções do CRM" className="function-side-nav">
          {crmFunctions.map(item=><button type="button" key={item.id} className={"function-side-button"+(group.id===item.id?" active":"")} aria-current={group.id===item.id?"page":undefined} onClick={()=>switchGroup(item.id)}>
            <span>{item.title}</span><small>{operationsByGroup(item.id).length||item.sections.length} {operationsByGroup(item.id).length?"operações":"assuntos"}</small>
          </button>)}
        </nav>
        <div className="function-side-context">
          <span className="side-group">{operations.length?"OPERAÇÕES":"NESTA FUNÇÃO"}</span>
          {operations.map(op=><button type="button" key={op.id} className={"side-link operation-side-link"+(selectedOperation?.id===op.id?" active":"")} onClick={()=>switchOperation(op.id)} aria-current={selectedOperation?.id===op.id?"location":undefined}>{op.title}</button>)}
          <button type="button" className={"side-link reference-side-link"+(reader.mode==="reference"?" active":"")} onClick={()=>switchReference(group.sections[0])}><FileCode2 size={14}/> Referência técnica</button>
        </div>
      </aside>
      <article className="module-main">
        <header className="module-hero">
          <span className="eyebrow">PRODUTO E EXPERIÊNCIAS / P01</span>
          <Heading as="h1" className="serif-title">CRM.</Heading>
          <p className="subtitle">Relacionamentos organizados, contexto preservado.</p>
          <Text as="p" className="module-summary">Escolha uma função e depois uma operação. Cada ficha apresenta o comportamento, as regras e as evidências necessárias para compreender ou encaminhar um trabalho específico.</Text>
          <div className="module-status"><span className="status-pill">Auditoria técnica parcial</span><span>Revisão documental: 12 nov. 2026</span><span>6 funções · {crmOperations.length} operações documentadas</span></div>
        </header>
        <nav className="function-tabs" aria-label="Selecionar função do CRM">
          {crmFunctions.map(item=><button type="button" key={item.id} className={"function-tab"+(group.id===item.id?" active":"")} onClick={()=>switchGroup(item.id)} aria-current={group.id===item.id?"page":undefined}>
            {item.title}<span className="function-tab-count">{operationsByGroup(item.id).length||item.sections.length}</span>
          </button>)}
        </nav>
        <section className="function-intro" aria-labelledby="selected-function-heading">
          <span className="eyebrow">FUNÇÃO DO MÓDULO</span>
          <Heading as="h2" id="selected-function-heading">{group.title}</Heading>
          <p>{group.description}</p>
          {operations.length>0&&<div className="operation-selector" aria-label={"Operações de "+group.title}>
            {operations.map(op=><button key={op.id} type="button" className={"operation-choice"+(selectedOperation?.id===op.id?" active":"")} onClick={()=>switchOperation(op.id)} aria-current={selectedOperation?.id===op.id?"location":undefined}>
              <span><small>{op.kind}</small><strong>{op.title}</strong></span><ChevronRight size={17}/>
            </button>)}
          </div>}
          <button type="button" className="reference-mode-button" onClick={()=>switchReference(group.sections[0])}><BookOpenText size={16}/> Consultar os assuntos técnicos desta função</button>
        </section>
        {selectedOperation&&<div id="operation-reader-anchor" className="operation-reader"><OperationDetail key={selectedOperation.id} operation={selectedOperation}/></div>}
        {reader.mode==="reference"&&<div className="function-reference" id="reference-reader-anchor">
          <div className="reference-heading">
            <span className="eyebrow">CONSULTA TÉCNICA</span>
            <h3>{group.title} · assuntos originais</h3>
            <p>Conteúdo detalhado preservado, organizado por categoria e com referências ao fim de cada assunto.</p>
            <div className="function-topic-list" aria-label="Assuntos técnicos desta função">
              {group.sections.map(id=>{
                const section=byId.get(id);
                return <button type="button" key={id} className={"function-topic"+(reader.id===id?" active":"")} onClick={()=>switchReference(id)}><span>{section.number} · {section.title}</span><ChevronRight size={15}/></button>;
              })}
            </div>
          </div>
          <div className="function-content">{group.sections.map(id=><ReadingSection key={id} section={byId.get(id)} moduleId="P01"/>)}</div>
        </div>}
        <div className="endnote">
          <p>As fichas são camadas de leitura extraídas de registros do código. A presença de classe, método ou endpoint não prova homologação. Os 12 assuntos e seus inventários completos permanecem disponíveis na referência técnica de cada função.</p>
          <p><a href={CRM+"/STATUS.md"} target="_blank" rel="noopener noreferrer">Verificar o STATUS original <ArrowUpRight size={12} style={{display:"inline"}}/></a></p>
        </div>
      </article>
    </div>
  </SiteShell>;
}
