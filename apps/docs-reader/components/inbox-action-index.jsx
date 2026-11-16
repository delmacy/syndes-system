"use client";
import Link from "next/link";
import {useState} from "react";
import {ArrowLeft,ArrowUpRight,BookOpen,ChevronRight,Layers,Search} from "lucide-react";

export default function InboxActionIndex({catalog}){
 const [group,setGroup]=useState(catalog.groups[0].id);
 const [q,setQ]=useState("");
 const normalized=q.trim().toLocaleLowerCase("pt-BR");
 const active=catalog.groups.find(g=>g.id===group)||catalog.groups[0];
 const visible=catalog.actions.filter(a=>(!normalized?a.group===group:[a.title,a.id,a.group,a.method,a.permission].join(" ").toLocaleLowerCase("pt-BR").includes(normalized)));
 return <div className="master-page inbox-actions-page">
  <div className="master-topline"><Link href="/modulos/inbox"><ArrowLeft size={15}/> Voltar à Ficha Mestre</Link><span>SYNDES · P02 / AÇÕES</span></div>
  <header className="master-header"><div><span className="eyebrow">INBOX · 19 AÇÕES / 7 FUNÇÕES</span><h1>Trabalhe por ação<span> / P02</span></h1><p>Cada função mostra apenas suas próprias ações. Abra a ficha para ver contratos, SQL, edge cases, segurança e testes, com fonte versionada no GitHub.</p></div><div className="master-header-aside"><span className="master-caution">Código identificado; operação e aceite não homologados</span><Link href="/modulos/inbox">Ficha Mestre <BookOpen size={15}/></Link></div></header>
  <div className="inbox-actions-tools">
   <label className="master-search inbox-actions-search"><Search size={16}/><span className="sr-only">Buscar ações do Inbox</span><input value={q} onChange={e=>setQ(e.target.value)} type="search" placeholder="Buscar ação, método ou recurso..." aria-label="Buscar ações do Inbox"/></label>
   <span>{visible.length} {visible.length===1?"ação":"ações"} {normalized?"encontradas":"na função"}</span>
  </div>
  <div className="inbox-function-tabs" role="tablist" aria-label="Funções do Inbox">
  {catalog.groups.map(g=><button key={g.id} role="tab" type="button" aria-selected={g.id===group&&!normalized} onClick={()=>{setQ("");setGroup(g.id)}} className={"inbox-function-tab"+(g.id===group&&!normalized?" active":"")}>
    <Layers size={15}/><span>{g.title}</span><small>{catalog.actions.filter(a=>a.group===g.id).length}</small>
  </button>)}
  </div>
  <section className="inbox-action-results" aria-label={"Ações de "+(normalized?"busca":active.title)}>
   <div className="inbox-action-results-head"><h2>{normalized?"Resultados da busca":active.title}</h2><span>{catalog.actions.filter(a=>a.verb).length} contratos HTTP · {catalog.actions.filter(a=>!a.verb).length} consumidores</span></div>
   <div className="inbox-action-grid">
    {visible.map(a=><Link className="inbox-action-card" key={a.id} href={"/modulos/inbox/acoes/"+a.id}>
      <span className="inbox-action-kicker">{a.id} · {a.verb?"HTTP":"EVENTO"}</span>
      <strong>{a.title}</strong>
      <span className="inbox-action-description">{a.rules}</span>
      <span className="inbox-action-contract">{a.verb?a.verb+" "+a.route:a.input}</span>
      <span className="inbox-action-open">Abrir ficha A–J <ChevronRight size={15}/></span>
     </Link>)}
   </div>
   {visible.length===0&&<p>Nenhuma ação corresponde à busca. Verifique o termo ou escolha outra função.</p>}
  </section>
  <div className="inbox-doc-notes"><p>A matriz de ações é uma leitura do código, não uma lista de recursos homologados. Não executar migrations, grants ou workers por inferência documental.</p><a href="https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/MATRIZ-ACOES.md" target="_blank" rel="noopener noreferrer">Matriz canônica no GitHub <ArrowUpRight size={14}/></a></div>
 </div>;
}
