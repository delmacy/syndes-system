"use client";
import Link from "next/link";
import {useEffect,useState} from "react";
import {ArrowLeft,ArrowUpRight,BookOpen,ChevronRight,FileText} from "lucide-react";
import {RichMarkdown} from "./master-dossier-reader";

export default function InboxActionReader({dossier}){
 const [current,setCurrent]=useState("A");
 useEffect(()=>{
  const sync=()=>{const m=window.location.hash.match(/^#sec-([A-J])$/);if(m)setCurrent(m[1])};
  sync();window.addEventListener("hashchange",sync);window.addEventListener("popstate",sync);
  return()=>{window.removeEventListener("hashchange",sync);window.removeEventListener("popstate",sync)}
 },[]);
 const active=dossier.sections.find(s=>s.letter===current)||dossier.sections[0];
 const index=dossier.sections.findIndex(s=>s.letter===active.letter);
 const choose=letter=>{
   setCurrent(letter);
   window.history.pushState(null,"","#sec-"+letter);
   document.getElementById("inbox-action-heading")?.scrollIntoView({behavior:"smooth",block:"start"});
 };
 const base=dossier.sourceUrl;
 return <div className="master-page inbox-action-detail">
  <div className="master-topline"><Link href="/modulos/inbox/acoes"><ArrowLeft size={15}/> Voltar às funções e ações</Link><span>SYNDES · P02 / {dossier.id}</span></div>
  <header className="master-header">
   <div><span className="eyebrow">FICHA POR AÇÃO · TEMPLATE v1.0.0</span><h1>{dossier.title}</h1><p>Uma seção de cada vez: intenção, execução, dados, segurança, contratos e testes.</p></div>
   <div className="master-header-aside"><span className="master-caution">Código identificado; integração não homologada</span><span>{dossier.verb?dossier.verb+" "+dossier.route:"CONSUMIDOR ASSÍNCRONO"}</span><a href={base} target="_blank" rel="noopener noreferrer">Consultar fonte original <ArrowUpRight size={14}/></a></div>
  </header>
  <div className="master-workspace inbox-action-workspace">
   <aside className="master-index" aria-label="Seções da ficha da ação">
    <p>10 seções · A–J</p>
    <div className="master-index-items">{dossier.sections.map(s=><button type="button" key={s.letter} aria-current={s.letter===active.letter?"true":undefined} className={"master-index-item"+(s.letter===active.letter?" active":"")} onClick={()=>choose(s.letter)}>
       <span>{s.letter}</span><strong>{s.title}</strong><ChevronRight size={14}/>
     </button>)}</div>
    <div className="master-index-footer"><BookOpen size={15}/>O texto vem da ficha versionada, não de uma cópia mantida no frontend.</div>
   </aside>
   <article className="master-detail" aria-label={"Seção "+active.letter+" "+active.title}>
    <div className="master-detail-head" id="inbox-action-heading"><span>SEÇÃO {active.letter} / J</span><span>{dossier.group}</span></div>
    <h2>{active.title}</h2>
    <RichMarkdown body={active.body} base={base}/>
    <div className="master-detail-footer"><a href={base} target="_blank" rel="noopener noreferrer"><FileText size={15}/> Ver Markdown original <ArrowUpRight size={13}/></a><span>Edge cases e testes não executados permanecem identificados como candidatos.</span></div>
    <div className="master-step-actions"><button type="button" disabled={index===0} onClick={()=>choose(dossier.sections[index-1].letter)}>Anterior</button><button type="button" disabled={index===9} onClick={()=>choose(dossier.sections[index+1].letter)}>Próxima seção <ChevronRight size={14}/></button></div>
   </article>
   <aside className="master-sources" aria-label="Fontes e ações relacionadas"><span className="eyebrow">LEITURA VINCULADA</span><Link href="/modulos/inbox">Ficha Mestre</Link><Link href="/modulos/inbox/acoes">Índice de funções</Link><a href="https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/INVENTARIO-TECNICO.md" target="_blank" rel="noopener noreferrer">Inventário técnico <ArrowUpRight size={13}/></a><a href="https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/PARIDADE-CODIGO.md" target="_blank" rel="noopener noreferrer">Paridade do código <ArrowUpRight size={13}/></a><a href="https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/STATUS.md" target="_blank" rel="noopener noreferrer">Status e gates <ArrowUpRight size={13}/></a></aside>
  </div>
 </div>;
}
