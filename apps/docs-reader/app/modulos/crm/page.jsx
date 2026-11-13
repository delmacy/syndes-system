"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Heading, Text } from "@chakra-ui/react";
import { ArrowLeft, ArrowUpRight, ChevronRight } from "lucide-react";
import SiteShell from "@/components/site-shell";
import ReadingSection from "@/components/reading-section";
import { crmSections, CRM } from "@/lib/content";
import { crmFunctions, crmFunctionForSection } from "@/lib/crm-functions";

const byId = new Map(crmSections.map(section => [section.id,section]));
function groupFromHash(){
  if(typeof window==="undefined")return crmFunctions[0];
  const sectionId=decodeURIComponent(window.location.hash.slice(1));
  return crmFunctionForSection(sectionId)||crmFunctions.find(group=>group.id===sectionId)||crmFunctions[0];
}
export default function CrmPage(){
  const [selected,setSelected]=useState(crmFunctions[0].id);
  const [active,setActive]=useState(crmFunctions[0].sections[0]);
  useEffect(()=>{
    const sync=()=>{
      const group=groupFromHash();
      setSelected(group.id);
      const sectionId=decodeURIComponent(window.location.hash.slice(1));
      setActive(group.sections.includes(sectionId)?sectionId:group.sections[0]);
    };
    sync();
    window.addEventListener("hashchange",sync);
    window.addEventListener("popstate",sync);
    return ()=>{
      window.removeEventListener("hashchange",sync);
      window.removeEventListener("popstate",sync);
    };
  },[]);
  const group=crmFunctions.find(item=>item.id===selected)||crmFunctions[0];
  const navigate=(sectionId)=>{
    const target=crmFunctionForSection(sectionId);
    if(!target)return;
    setSelected(target.id);
    setActive(sectionId);
    window.history.pushState(null,"","#"+sectionId);
    window.scrollTo({top:0,behavior:"instant"});
  };
  const switchGroup=(groupId)=>{
    const next=crmFunctions.find(g=>g.id===groupId);
    if(next)navigate(next.sections[0]);
  };
  return <SiteShell>
    <div className="module-layout">
      <aside className="module-sidebar" aria-label="Funções do CRM">
        <div className="side-top">EXPLORAR O CRM</div>
        <Link href="/" className="sidebar-home"><ArrowLeft size={14}/> Visão da plataforma</Link>
        <nav aria-label="Funções do CRM" className="function-side-nav">
          {crmFunctions.map(item=><button key={item.id} type="button" className={"function-side-button"+(selected===item.id?" active":"")} aria-current={selected===item.id?"page":undefined} onClick={()=>switchGroup(item.id)}>
            <span>{item.title}</span><small>{item.sections.length} {item.sections.length===1?"assunto":"assuntos"}</small>
          </button>)}
        </nav>
        <div className="function-side-context">
          <span className="side-group">NESTA FUNÇÃO</span>
          {group.sections.map(id=>{
            const section=byId.get(id);
            return <button key={id} type="button" className={"side-link"+(active===id?" active":"")} onClick={()=>navigate(id)} aria-current={active===id?"location":undefined}><span>{section.number}</span>{section.title}</button>;
          })}
        </div>
      </aside>
      <article className="module-main">
        <header className="module-hero">
          <span className="eyebrow">PRODUTO E EXPERIÊNCIAS / P01</span>
          <Heading as="h1" className="serif-title">CRM.</Heading>
          <p className="subtitle">Relacionamentos organizados, contexto preservado.</p>
          <Text as="p" className="module-summary">O CRM reúne pessoas, organizações de relacionamento, notas e histórico de interações. Escolha uma função para examinar seu comportamento, sua implementação e suas evidências sem percorrer o módulo inteiro.</Text>
          <div className="module-status"><span className="status-pill">Auditoria técnica parcial</span><span>Revisão documental: 12 nov. 2026</span><span>6 funções · 12 assuntos</span></div>
        </header>
        <nav className="function-tabs" aria-label="Selecionar função do CRM">
          {crmFunctions.map(item=><button type="button" key={item.id} className={"function-tab"+(selected===item.id?" active":"")} onClick={()=>switchGroup(item.id)} aria-current={selected===item.id?"page":undefined}>
            {item.title}<span className="function-tab-count">{item.sections.length}</span>
          </button>)}
        </nav>
        <section className="function-intro" aria-labelledby="selected-function-heading">
          <span className="eyebrow">FUNÇÃO DO MÓDULO</span>
          <Heading as="h2" id="selected-function-heading">{group.title}</Heading>
          <p>{group.description}</p>
          <div className="function-topic-list" aria-label="Assuntos desta função">
            {group.sections.map(id=>{
              const section=byId.get(id);
              return <button type="button" key={id} className={"function-topic"+(active===id?" active":"")} onClick={()=>navigate(id)}>
                <span>{section.number} · {section.title}</span><ChevronRight size={15}/>
              </button>;
            })}
          </div>
        </section>
        <div className="function-content" key={group.id}>
          {group.sections.map(id=><ReadingSection key={id} section={byId.get(id)} moduleId="P01"/>)}
        </div>
        <div className="endnote">
          <p>Esta biblioteca apresenta uma camada editorial de leitura humana. As fontes versionadas permanecem autoritativas, e as propostas digitadas aqui ficam apenas no navegador até serem exportadas e revisadas.</p>
          <p><a href={CRM+"/STATUS.md"} target="_blank" rel="noopener noreferrer">Verificar o STATUS original <ArrowUpRight size={12} style={{display:"inline"}}/></a></p>
        </div>
      </article>
    </div>
  </SiteShell>;
}
