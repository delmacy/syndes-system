"use client";
import { useState } from "react";
import { ArrowUpRight, Network, Database, ShieldCheck, ListTree } from "lucide-react";
import routes from "@/lib/crm-api-inventory.json";
import methods from "@/lib/crm-method-inventory.json";
import tables from "@/lib/crm-data-inventory.json";

const repo="https://github.com/delmacy/syndes-system/blob/main/";
const views=[
 {id:"arquitetura",title:"Camadas e dependências",nodes:[
 ["Workspace",60,40],["Host / NestJS",320,40],["Core Kernel / FGA",580,40],["CRM Service",320,145],["Tenant DB",580,145],["Platform Control",805,40]],
 edges:[[0,1],[1,2],[1,3],[3,2],[3,4],[2,5]]},
 {id:"dados",title:"Persistência CRM — relações principais",nodes:[
 ["crm_people",390,30],["crm_organizations",60,140],["crm_person_organizations",390,140],
 ["crm_tags",700,140],["crm_person_tags",700,230],["crm_notes",160,255],
 ["crm_employees",390,255],["crm_channel_identities",610,330],["crm_audit",60,345]],
 edges:[[0,2],[1,2],[0,4],[3,4],[0,5],[0,6],[0,7]]},
 {id:"identidade",title:"Resolução de identidade WhatsApp",nodes:[
 ["Inbox participant",50,85],["Evento observed.v1",295,85],["Policy decide",535,85],
 ["person.resolved.v1",775,30],["review_required.v1",775,155]],
 edges:[[0,1],[1,2],[2,3],[2,4]]},
 {id:"seguranca",title:"Caminho de autorização HTTP",nodes:[
 ["Bearer / Actor",40,80],["Tenant + contexto",255,80],["Core Kernel / FGA",480,80],
 ["CRM Service",700,80],["Tenant DB filtrado",700,210]],
 edges:[[0,1],[1,2],[2,3],[3,4]]}
];
function Diagram({model}){
 const nodeMap=new Map(model.nodes.map(([label,x,y],i)=>[i,{label,x,y}]));
 const height=model.id==="dados"?435:310;
 const color="#225ab0", background="#f2f6fd";
 return <div className="crm-diagram-wrap">
  <svg role="img" aria-label={model.title} viewBox={`0 0 1010 ${height}`} width="100%" xmlns="http://www.w3.org/2000/svg">
   <title>{model.title}</title><desc>Mapa conceitual dos componentes e suas conexões identificadas no código. As setas representam dependência ou fluxo; não comprovam ativação operacional.</desc>
   <defs><marker id={`arrow-${model.id}`} markerWidth="9" markerHeight="9" refX="7" refY="3" orient="auto"><path d="M0 0 L7 3 L0 6 Z" fill={color}/></marker></defs>
   {model.edges.map(([a,b],i)=>{
    const p=nodeMap.get(a),q=nodeMap.get(b),px=p.x+85,py=p.y+27,qx=q.x+85,qy=q.y+27;
    const dx=qx-px,dy=qy-py,den=Math.max(Math.abs(dx)/90,Math.abs(dy)/34,1);
    const sx=px+dx/den*.70,sy=py+dy/den*.70,ex=qx-dx/den*.70,ey=qy-dy/den*.70;
    return <line key={i} x1={sx} y1={sy} x2={ex} y2={ey} stroke={color} strokeWidth="2" opacity=".68" markerEnd={`url(#arrow-${model.id})`}/>;
   })}
   {model.nodes.map(([label,x,y],i)=><g key={i}><rect x={x} y={y} width="180" height="54" rx="11" fill={background} stroke="#a9c2e9"/><text x={x+90} y={y+29} fill="#213c62" fontSize="13" textAnchor="middle" fontWeight="600">{label}</text></g>)}
  </svg>
 </div>;
}
const nav=[["diagramas","Diagramas"],["apis","APIs"],["metodos","Classes e métodos"],["dados","Dados e SQL"],["seguranca","Segurança e testes"]];
export default function CrmTechnicalAtlas(){
 const [tab,setTab]=useState("diagramas"),[filter,setFilter]=useState(""),[diagram,setDiagram]=useState("arquitetura");
 const filtered=routes.filter(r=>[r.method,r.path,r.actionId,r.permission].join(" ").toLowerCase().includes(filter.toLowerCase()));
 return <section className="crm-atlas" aria-labelledby="crm-atlas-heading">
  <span className="eyebrow">P01 · INVENTÁRIO TÉCNICO</span>
  <h2 id="crm-atlas-heading">Atlas do CRM</h2>
  <p>Mapa integral das superfícies declaradas no código, não uma certificação de implantação. Ações, contratos, tabelas e testes devem permanecer rastreáveis até as fontes canônicas.</p>
  <div className="operation-tablist" role="tablist" aria-label="Esferas do atlas CRM">
   {nav.map(([id,label])=><button key={id} type="button" role="tab" aria-selected={tab===id} className={"operation-tab"+(tab===id?" active":"")} onClick={()=>setTab(id)}>{label}</button>)}
  </div>
  <div className="crm-atlas-panel" role="tabpanel">
   {tab==="diagramas"&&<>
     <h3>Diagramas de arquitetura e comportamento</h3>
     <div className="crm-diagram-switch" aria-label="Escolher diagrama">{views.map(v=><button className={diagram===v.id?"active":""} key={v.id} type="button" onClick={()=>setDiagram(v.id)}>{v.title}</button>)}</div>
     <Diagram model={views.find(v=>v.id===diagram)}/>
     <p className="operation-evidence-note">Diagramas conceituais baseados no código do módulo e nas migrations SQL; ver também os diagramas Mermaid versionados em <a href={repo+"docs/subprojects/P01-crm/DIAGRAMAS.md"} target="_blank" rel="noopener noreferrer">DIAGRAMAS.md</a>. O diagrama de persistência distingue as tabelas relacionadas: crm_audit é um registro lógico de auditoria, sem FK para crm_people.</p>
   </>}
   {tab==="apis"&&<>
     <h3>Inventário das {routes.length} rotas HTTP</h3>
     <p>Prefixo declarado pelo controller: <code>/v1/tenants/:tenantId/crm</code>. O status de runtime e a resposta exata dependem de testes com o Host.</p>
     <label className="crm-filter-label" htmlFor="crm-api-filter">Filtrar por rota, verbo, ação ou permissão</label>
     <input id="crm-api-filter" className="crm-atlas-filter" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Ex.: /people, write, csv" />
     <div className="evidence-scroll" role="region" aria-label="APIs HTTP CRM" tabIndex={0}><table className="evidence-table"><thead><tr><th>Verbo</th><th>Rota declarada</th><th>Permissão de referência</th><th>Ficha</th></tr></thead><tbody>{filtered.map(r=><tr key={r.method+r.path}><td><code>{r.method}</code></td><td><code>{r.path}</code></td><td>{r.permission}</td><td><a href={"#"+r.actionId}>{r.actionId}</a></td></tr>)}</tbody></table></div>
     <p className="operation-evidence-note">Permissões acima são mapeamento documental do recurso; regras reais adicionais de contexto e autorização devem ser consultadas no controller e nos guardas. <a href={repo+"modules/core-crm/src/crm.controller.ts"} target="_blank" rel="noopener noreferrer">Fonte HTTP <ArrowUpRight size={12}/></a></p>
   </>}
   {tab==="metodos"&&<>
     <h3>Assinaturas encontradas em quatro arquivos</h3>
     <p>{methods.length} assinaturas detectadas, incluindo métodos de serviço, repositório, interface e implementação. Não representam {methods.length} APIs públicas distintas.</p>
     <div className="evidence-scroll" role="region" aria-label="Inventário de métodos CRM" tabIndex={0}><table className="evidence-table"><thead><tr><th>Método / assinatura</th><th>Fonte</th></tr></thead><tbody>{methods.map((m,i)=><tr key={i}><td><code>{m.signature}</code></td><td><a href={repo+m.file+"#L"+m.line} target="_blank" rel="noopener noreferrer">{m.file.split("/").pop()}:{m.line}</a></td></tr>)}</tbody></table></div>
   </>}
   {tab==="dados"&&<>
    <h3>Dicionário de persistência — {tables.length} tabelas / {tables.reduce((sum,t)=>sum+t.columns.length,0)} colunas</h3>
    <p>Definições extraídas das migrations 001–003 do tenant. Aplicação em ambientes reais não foi auditada neste inventário; restrições compostas e índices devem ser conferidos no SQL integral.</p>
    {tables.map(table=><details className="crm-table-detail" key={table.table}><summary><Database size={15}/> <strong>{table.table}</strong> <span>{table.columns.length} colunas · {table.migration.split("_")[0]}</span></summary><div className="evidence-scroll" role="region" aria-label={"Colunas "+table.table} tabIndex={0}><table className="evidence-table"><thead><tr><th>Coluna</th><th>Tipo</th><th>Declaração</th></tr></thead><tbody>{table.columns.map(c=><tr key={c.name}><td><code>{c.name}</code></td><td>{c.type}</td><td>{c.constraints||"—"}</td></tr>)}</tbody></table></div><a href={repo+table.source} target="_blank" rel="noopener noreferrer">Abrir migration SQL <ArrowUpRight size={12}/></a></details>)}
   </>}
   {tab==="seguranca"&&<>
    <h3>Recursos declarados no plugin</h3>
    <div className="evidence-scroll" role="region" tabIndex={0} aria-label="Recursos de permissão CRM"><table className="evidence-table"><thead><tr><th>Recurso</th><th>Ações</th><th>Estado de aceite</th></tr></thead><tbody>{[["crm:context","read"],["crm:people","read / write"],["crm:organizations","read / write"],["crm:relationships","write"],["crm:tags","read / write"],["crm:notes","read / write"],["crm:employees","read / write"],["crm:channels","read / write"]].map(([resource,actions])=><tr key={resource}><td><code>{resource}</code></td><td>{actions}</td><td>Homologação real pendente</td></tr>)}</tbody></table></div>
    <h3>Gates e evidências que faltam</h3>
    <ul className="operation-rules">
     <li>JWT Keycloak e decisões OpenFGA reais, com negativas 401/403.</li>
     <li>Isolamento tenant A/B e organização/workspace em PostgreSQL real.</li>
     <li>SQL 002 de organização única e Stage C2/C3: não liberar multi-org.</li>
     <li>Revisão de identidades ambíguas e cutover do consumidor Event Bus.</li>
     <li>Backup, restauração, rollback, observabilidade e aceite operacional por SHA.</li>
    </ul>
    <p className="operation-evidence-note">Fontes: <a href={repo+"modules/core-crm/src/plugin.ts"} target="_blank" rel="noopener noreferrer">Plugin</a>, <a href={repo+"modules/core-crm/src/context-guard.ts"} target="_blank" rel="noopener noreferrer">Context Guard</a> e <a href={repo+"docs/subprojects/P01-crm/STATUS.md"} target="_blank" rel="noopener noreferrer">STATUS P01</a>.</p>
   </>}
  </div>
 </section>;
}
