"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Box, Heading, Text } from "@chakra-ui/react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import SiteShell from "@/components/site-shell";
import ReadingSection from "@/components/reading-section";
import { crmSections, CRM } from "@/lib/content";

export default function CrmPage() {
  const [active,setActive]=useState(crmSections[0].id);
  useEffect(()=>{
    const update=()=>{
      const line=window.scrollY+155;
      let current=crmSections[0].id;
      for(const section of crmSections){const el=document.getElementById(section.id);if(el && el.offsetTop<=line)current=section.id;}
      setActive(current);
    };
    update();
    window.addEventListener("scroll",update,{passive:true});
    return ()=>window.removeEventListener("scroll",update);
  },[]);
  let lastGroup="";
  return <SiteShell>
    <div className="module-layout">
      <aside className="module-sidebar" aria-label="Índice do CRM">
        <div className="side-top">NESTE CAPÍTULO</div>
        <Link href="/" className="sidebar-home"><ArrowLeft size={14}/> Visão da plataforma</Link>
        <nav aria-label="Assuntos do CRM">
          {crmSections.map(section=>{
            const show=section.group!==lastGroup;lastGroup=section.group;
            return <div key={section.id}>
              {show&&<div className="side-group">{section.group}</div>}
              <a href={"#"+section.id} className={"side-link"+(active===section.id?" active":"")} aria-current={active===section.id?"location":undefined}><span>{section.number}</span>{section.title}</a>
            </div>;
          })}
        </nav>
      </aside>
      <article className="module-main">
        <header className="module-hero">
          <span className="eyebrow">PRODUTO E EXPERIÊNCIAS / P01</span>
          <Heading as="h1" className="serif-title">CRM.</Heading>
          <p className="subtitle">Relacionamentos organizados, contexto preservado.</p>
          <Text as="p" className="module-summary">O CRM reúne pessoas, organizações de relacionamento, notas e histórico de interações. Ele ajuda a preservar o contexto de cada relação, sem confundir entidades comerciais com a estrutura administrativa de cada tenant.</Text>
          <div className="module-status"><span className="status-pill">Auditoria técnica parcial</span><span>Revisão documental: 12 nov. 2026</span><span>12 assuntos</span></div>
        </header>
        <details className="mobile-outline"><summary>Explorar os 12 assuntos deste módulo</summary><nav aria-label="Índice mobile do CRM">{crmSections.map(s=><a href={"#"+s.id} key={s.id}>{s.number} · {s.title}</a>)}</nav></details>
        {crmSections.map(s=><ReadingSection key={s.id} section={s} moduleId="P01"/>)}
        <div className="endnote">
          <p>Esta biblioteca apresenta uma camada editorial de leitura humana. As fontes versionadas permanecem autoritativas, e as propostas digitadas aqui ficam apenas no navegador até serem exportadas e revisadas.</p>
          <p><a href={CRM+"/STATUS.md"} target="_blank" rel="noopener noreferrer">Verificar o STATUS original <ArrowUpRight size={12} style={{display:"inline"}}/></a></p>
        </div>
      </article>
    </div>
  </SiteShell>;
}
