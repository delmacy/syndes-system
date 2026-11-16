"use client";
import Link from "next/link";
import { useEffect,useMemo,useState } from "react";
import { ArrowLeft,ArrowUpRight,BookOpen,ChevronRight,FileText,Search } from "lucide-react";

const pattern=/(\[[^\]]+\]\([^)]+\)|\x60[^\x60]+\x60|\*\*[^*]+\*\*)/g;
function LinkOrText({text,base}){
  return String(text||"").split(pattern).filter(Boolean).map((piece,i)=>{
    if(piece.startsWith("**")&&piece.endsWith("**"))return <strong key={i}>{piece.slice(2,-2)}</strong>;
    if(piece.startsWith("`")&&piece.endsWith("`"))return <code key={i}>{piece.slice(1,-1)}</code>;
    const match=piece.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if(match){
      let href=match[2].replace(/^<|>$/g,"");
      if(!/^(https?:|#|mailto:)/i.test(href))href=new URL(href,base).href;
      if(!/^(https?:|#|mailto:)/i.test(href))return match[1];
      return <a key={i} href={href} target="_blank" rel="noopener noreferrer">{match[1]}<ArrowUpRight size={12}/></a>;
    }
    return piece;
  });
}
function cells(line){
 const data=line.trim().replace(/^\|/,"").replace(/\|$/,"");
 // Pipes inside inline code must not split Markdown table columns.
 let parts=[],part="",code=false,escaped=false;
 for(const ch of data){
   if(escaped){part+=ch;escaped=false;continue;}
   if(ch==="\\"){escaped=true;part+=ch;continue;}
   if(ch==="`")code=!code;
   if(ch==="|"&&!code){parts.push(part.trim());part="";}else part+=ch;
 }
 parts.push(part.trim());
 return parts;
}
function contentBlocks(body){
 const lines=body.split(/\r?\n/), blocks=[];
 for(let i=0;i<lines.length;){
   const line=lines[i].trim();
   if(!line){i++;continue;}
   if(/^\|/.test(line)){
     const all=[];while(i<lines.length&&/^\s*\|/.test(lines[i]))all.push(cells(lines[i++]));
     const headers=all[0]||[],rows=all.slice(1).filter(row=>!row.every(x=>/^:?-+:?$/.test(x.replace(/\s/g,""))));
     blocks.push({type:"table",headers,rows});continue;
   }
   if(line.startsWith("```")){
     const language=line.slice(3),part=[];i++;
     while(i<lines.length&&!lines[i].trim().startsWith("```"))part.push(lines[i++]);
     i++;blocks.push({type:"code",language,value:part.join("\n")});continue;
   }
   if(/^### /.test(line)){blocks.push({type:"subheading",value:line.slice(4)});i++;continue;}
   if(/^> /.test(line)){blocks.push({type:"note",value:line.slice(2)});i++;continue;}
   if(/^- /.test(line)){
     const items=[];while(i<lines.length&&/^- /.test(lines[i].trim()))items.push(lines[i++].trim().slice(2));
     blocks.push({type:"bullets",items});continue;
   }
   if(/^[0-9]+\. /.test(line)){
     const items=[];while(i<lines.length&&/^[0-9]+\. /.test(lines[i].trim()))items.push(lines[i++].trim().replace(/^[0-9]+\. /,""));
     blocks.push({type:"numbers",items});continue;
   }
   const para=[];while(i<lines.length&&lines[i].trim()&&!/^([|]|### |>|- |[0-9]+\. |```)/.test(lines[i].trim()))para.push(lines[i++].trim());
   if(para.length){blocks.push({type:"paragraph",value:para.join(" ")});continue;}
   i++; // Unknown Markdown construct: avoid looping indefinitely.
 }
 return blocks;
}
export function RichMarkdown({body,base}){
 const blocks=useMemo(()=>contentBlocks(body),[body]);
 return <div className="master-prose">
 {blocks.map((b,i)=>{
   if(b.type==="subheading")return <h3 key={i}><LinkOrText text={b.value} base={base}/></h3>;
   if(b.type==="paragraph")return <p key={i}><LinkOrText text={b.value} base={base}/></p>;
   if(b.type==="note")return <blockquote key={i}><LinkOrText text={b.value} base={base}/></blockquote>;
   if(b.type==="code")return <pre key={i} className="master-code" aria-label={"Bloco de código "+b.language}><code>{b.value}</code></pre>;
   if(b.type==="table")return <div className="master-table-scroll" key={i} role="region" aria-label="Tabela da seção" tabIndex={0}><table><thead><tr>{b.headers.map((v,j)=><th key={j} scope="col"><LinkOrText text={v} base={base}/></th>)}</tr></thead><tbody>{b.rows.map((row,j)=><tr key={j}>{b.headers.map((_,k)=><td key={k}><LinkOrText text={row[k]||""} base={base}/></td>)}</tr>)}</tbody></table></div>;
   if(b.type==="bullets")return <ul key={i}>{b.items.map((v,j)=><li key={j}><LinkOrText text={v} base={base}/></li>)}</ul>;
   if(b.type==="numbers")return <ol key={i}>{b.items.map((v,j)=><li key={j}><LinkOrText text={v} base={base}/></li>)}</ol>;
   return null;
 })}
 </div>;
}
export default function MasterDossierReader({dossier}){
 const {sections,groups}=dossier;
 const [selected,setSelected]=useState("00");
 const [search,setSearch]=useState("");
 useEffect(()=>{
   const sync=()=>{const m=location.hash.match(/^#sec-([0-9]{2})$/);if(m&&sections.some(x=>x.number===m[1]))setSelected(m[1]);};
   sync();window.addEventListener("popstate",sync);window.addEventListener("hashchange",sync);
   return ()=>{window.removeEventListener("popstate",sync);window.removeEventListener("hashchange",sync);};
 },[sections]);
 const active=sections.find(x=>x.number===selected)||sections[0];
 const selectedGroup=groups.find(g=>g.numbers.includes(active.number))||groups[0];
 const result=useMemo(()=>sections.filter(s=>(s.number+" "+s.title+" "+s.body).toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))),[sections,search]);
 const selectedInGroup=search?result:sections.filter(s=>selectedGroup.numbers.includes(s.number));
 const select=(num)=>{
   setSelected(num);
   if(location.hash!=="#sec-"+num)window.history.pushState(null,"","#sec-"+num);
   document.getElementById("master-content-heading")?.scrollIntoView({behavior:"smooth",block:"start"});
 };
 const base=dossier.github+dossier.documentPath;
 const sourceUrl=base;
 return <div className="master-page">
   <div className="master-topline"><Link href={dossier.back}><ArrowLeft size={15}/>{dossier.backLabel}</Link><span>SYNDES · BIBLIOTECA / {dossier.id}</span></div>
   <header className="master-header">
     <div><span className="eyebrow">FICHA MESTRE · TEMPLATE v1.0.0</span><h1>{dossier.name}<span> / documentação</span></h1><p>{dossier.subtitle}. As 22 seções aparecem individualmente, preservando o conteúdo do Markdown no GitHub.</p></div>
     <div className="master-header-aside"><span className="master-caution">{dossier.state}</span><span>{sections.length} seções · 5 grupos de leitura</span><a href={sourceUrl} target="_blank" rel="noopener noreferrer">Ver ficha original <ArrowUpRight size={14}/></a>{dossier.actionIndex&&<Link className="master-action-index-link" href={dossier.actionIndex}>Explorar ações do módulo <ChevronRight size={14}/></Link>}</div>
   </header>
   <p className="master-mobile-hint">Deslize para ver os grupos da ficha <span aria-hidden="true">→</span></p>
   <div className="master-group-tabs" role="tablist" aria-label="Grupos da Ficha Mestre">
     {groups.map((g,i)=><button role="tab" type="button" key={g.id} id={"master-group-"+g.id} aria-controls="master-section-view" aria-selected={g.id===selectedGroup.id} className={"master-group-tab"+(g.id===selectedGroup.id&&!search?" active":"")} onClick={()=>{setSearch("");select(g.numbers[0]);}}>
       <small>{String(i+1).padStart(2,"0")}</small><span>{g.title}</span>
     </button>)}
   </div>
   <div className="master-workspace">
     <aside className="master-index" aria-label="Seções da Ficha Mestre">
       <label className="master-search"><Search size={16}/><span className="sr-only">Buscar nas 22 seções</span><input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar na ficha..."/></label>
       <p>{search?result.length+" seções encontradas":selectedGroup.title}</p>
       <div className="master-index-items">{selectedInGroup.map(s=><button key={s.number} type="button" aria-current={s.number===selected?"true":undefined} className={"master-index-item"+(s.number===selected?" active":"")} onClick={()=>select(s.number)}><span>{s.number}</span><strong>{s.title}</strong><ChevronRight size={14}/></button>)}{selectedInGroup.length===0&&<p>Nenhuma seção corresponde à busca.</p>}</div>
       <div className="master-index-footer"><BookOpen size={15}/>Uma seção por vez. O código e os testes permanecem nas fontes vinculadas.</div>
     </aside>
     <article className="master-detail" role="tabpanel" id="master-section-view" aria-labelledby={"master-group-"+selectedGroup.id} aria-label={"Seção "+active.number+" "+active.title}>
       <div className="master-detail-head" id="master-content-heading"><span>SEÇÃO {active.number} / 21</span><span>{selectedGroup.title}</span></div>
       <h2>{active.title}</h2>
       <RichMarkdown body={active.body} base={base}/>
       <div className="master-detail-footer">
         <a href={sourceUrl} target="_blank" rel="noopener noreferrer"><FileText size={15}/> Conferir conteúdo versionado <ArrowUpRight size={13}/></a>
         <span>Planejamento e implementação exigem decisão explícita e provas reais.</span>
       </div>
       <div className="master-step-actions">
         <button type="button" disabled={Number(active.number)===0} onClick={()=>select(String(Number(active.number)-1).padStart(2,"0"))}>Seção anterior</button>
         <button type="button" disabled={Number(active.number)===21} onClick={()=>{setSearch("");select(String(Number(active.number)+1).padStart(2,"0"))}}>Próxima seção <ChevronRight size={14}/></button>
       </div>
     </article>
     <aside className="master-sources" aria-label="Referências do módulo">
       <span className="eyebrow">FONTES CANÔNICAS</span>
       {dossier.sources.map(s=><a href={dossier.github+s.path} key={s.path} target="_blank" rel="noopener noreferrer">{s.label}<ArrowUpRight size={13}/></a>)}
       <p>Conteúdo sincronizado com a revisão do repositório usada no build. Publicar um commit novo exige atualizar o portal para refletir as alterações.</p>
     </aside>
   </div>
 </div>;
}
