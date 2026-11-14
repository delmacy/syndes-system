"use client";
import { useState } from "react";
import { ArrowUpRight, Check, ClipboardCopy, Download, FileCode2, ShieldCheck, TableProperties } from "lucide-react";
import ProposalEditor from "./proposal-editor";
import crmRoutes from "@/lib/crm-api-inventory.json";

export function agentBrief(operation) {
  const lines=[
    "# Syndes / P01 CRM — tarefa focada",
    "Operação: "+operation.title+" ("+operation.id+")",
    "Ficha canônica: https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/acoes/"+operation.id+".md",
    "Situação: "+operation.state,
    "Objetivo: "+operation.objective,
    "",
    "## Escopo estrito",
    operation.task,
    "Preservar tenancy, autorização, contratos existentes e integrações desacopladas. Não habilitar módulos, executar migrations, alterar gates ou afirmar homologação sem testes e autorização explícita.",
    "",
    "## Contrato encontrado no código",
    "- Método: "+operation.contract.method,
    "- HTTP declarado: "+operation.contract.http,
    "- Permissão: "+operation.contract.permission,
    "- Persistência: "+operation.contract.data,
    "",
    "## Comportamento",
    ...operation.behavior.map((step,i)=>(i+1)+". "+step),
    "",
    "## Regras",
    ...operation.rules.map(rule=>"- "+rule),
    "",
    "## Critérios de aceite a verificar",
    ...operation.acceptance.map(rule=>"- [ ] "+rule),
    "",
    "## Fontes de verdade",
    ...operation.sources.map(s=>"- "+s.label+": "+s.url),
    "",
    "A primeira tarefa do agente é reconciliar o código atual e sua SHA com estas referências. Propor alterações e testes somente depois da verificação. Não tratar este briefing como autorização para executar."
  ];
  return lines.join("\n");
}
export function crmWorkPrompt(operation,mode){
 const planning=mode==="planning";
 return [
  "# SYNDES / CRM — "+(planning?"PLANEJAMENTO":"IMPLEMENTAÇÃO")+" FOCADA",
  "Operação: "+operation.title+" ("+operation.id+")",
    "Ficha canônica: https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/acoes/"+operation.id+".md",
  "Estado documental: "+operation.state,
  "Objetivo: "+operation.objective,
  "Contrato: "+operation.contract.method,
  "HTTP declarado: "+operation.contract.http,
  "Permissão: "+operation.contract.permission,
  "Persistência: "+operation.contract.data,
  "Fontes:",...operation.sources.map(s=>"- "+s.url),
  "",
  "INSTRUÇÕES",
  "1. Verifique SHA, branch/worktree, AGENTS.md, escopo e STATUS; preserve alterações alheias.",
  "2. Confirme código, testes e contratos reais. Não trate documentação como aceite.",
  planning
   ?"3. Avalie impacto, risco, mudanças em API/dados/segurança/eventos e proponha WBS e critérios de aceite SEM implementar."
   :"3. Execute somente requisito APROVADO e critérios de aceite fornecidos pelo proprietário. Sem decisão aprovada, não implemente.",
  planning
   ?"4. Entregue planejamento, arquivos afetados, testes e questões para decisão."
   :"4. Execute testes, registre evidências e atualize a documentação, diagramas, status e WBS pertinentes.",
  "5. Não ative workers, execute migrations, grants ou deploy sem gates e autorização específica.",
  "",
  "OBSERVAÇÃO / DECISÃO DO PROPRIETÁRIO:",
  "[Inserir observação exportada e, se for implementação, ID do requisito aprovado.]"
 ].join("\n");
}
const TABS=[
  ["resumo","Resumo"],["fluxo","Fluxo"],["contratos","Contratos"],["dados","Dados"],
  ["api","API"],["seguranca","Segurança"],["testes","Testes"],["operacao","Operação"],["pendencias","Pendências"]
];
function Unverified({children="Não documentado nas evidências desta operação."}) {
  return <p className="operation-unverified">{children}</p>;
}
export default function OperationDetail({operation}) {
  const [tab,setTab]=useState("resumo");
  const [feedback,setFeedback]=useState("");
  const copy=async()=>{
    try {await navigator.clipboard.writeText(agentBrief(operation));setFeedback("Briefing copiado para revisão por um agente.");}
    catch {setFeedback("O navegador bloqueou a cópia. Use a exportação do briefing em Markdown.");}
  };
  const download=()=>{
    const blob=new Blob([agentBrief(operation)],{type:"text/markdown;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");
    link.href=url;
    link.download="syndes-p01-"+operation.id+"-briefing.md";
    link.click();
    URL.revokeObjectURL(url);
    setFeedback("Briefing Markdown exportado para revisão.");
  };
  const tabId="operation-panel-"+tab;
  return <section className="operation-detail" aria-labelledby="operation-title" id={operation.id}>
    <div className="operation-head">
      <div><span className="eyebrow">OPERAÇÃO · {operation.kind}</span><h3 id="operation-title">{operation.title}</h3></div>
      <span className="operation-status">{operation.state}</span>
    </div>
    <p className="operation-purpose">{operation.objective}</p>
    <div className="operation-tablist" role="tablist" aria-label={"Documentação de "+operation.title}>
      {TABS.map(([id,label])=><button key={id} type="button" role="tab" id={"operation-tab-"+id} aria-selected={tab===id} aria-controls={"operation-panel-"+id} className={"operation-tab"+(tab===id?" active":"")} onClick={()=>setTab(id)}>{label}</button>)}
    </div>
    <div role="tabpanel" id={tabId} aria-labelledby={"operation-tab-"+tab} className="operation-tabpanel" tabIndex={0}>
      {tab==="resumo"&&<section className="operation-part">
        <div className="operation-part-title"><Check size={16}/><h4>Propósito e resultado</h4></div>
        <p>{operation.objective}</p>
        <p className="operation-result"><strong>Resultado:</strong> {operation.output||"Não documentado."}</p>
        <p className="operation-result"><strong>Estado declarado:</strong> {operation.state}</p>
        <p className="operation-result"><strong>Natureza:</strong> {operation.kind}</p>
        <p className="operation-evidence-note">O estado é documental; código identificado não comprova aceite, implantação ou homologação.</p>
      </section>}
      {tab==="fluxo"&&<section className="operation-part">
        <div className="operation-part-title"><Check size={16}/><h4>Como funciona</h4></div>
        {operation.behavior?.length?<ol className="operation-steps">{operation.behavior.map((step,i)=><li key={i}>{step}</li>)}</ol>:<Unverified/>}
        <h4>Regras do fluxo</h4>
        {operation.rules?.length?<ul className="operation-rules">{operation.rules.map((rule,i)=><li key={i}>{rule}</li>)}</ul>:<Unverified/>}
      </section>}
      {tab==="contratos"&&<section className="operation-part">
        <div className="operation-part-title"><FileCode2 size={16}/><h4>Contratos identificados</h4></div>
        <dl className="operation-contract"><div><dt>Classe ou método</dt><dd><code>{operation.contract?.method||"Não documentado"}</code></dd></div><div><dt>Permissão</dt><dd>{operation.contract?.permission||"Não documentado"}</dd></div></dl>
        <p>{operation.evidence||"Não há evidência técnica registrada."}</p>
        <Unverified>Contratos públicos/privados, comandos e eventos não discriminados nesta ficha devem ser reconciliados com a fonte; não são presumidos.</Unverified>
      </section>}
      {tab==="dados"&&<section className="operation-part">
        <div className="operation-part-title"><TableProperties size={16}/><h4>Entradas, persistência e saídas</h4></div>
        {operation.inputs?.length?<div className="evidence-scroll" role="region" tabIndex={0} aria-label="Entradas da operação"><table className="evidence-table"><thead><tr><th scope="col">Campo</th><th scope="col">Regra encontrada</th></tr></thead><tbody>{operation.inputs.map(([name,rule])=><tr key={name}><td><code>{name}</code></td><td>{rule}</td></tr>)}</tbody></table></div>:<Unverified/>}
        <p className="operation-result"><strong>Persistência:</strong> {operation.contract?.data||"Não documentada"}</p>
        <p className="operation-result"><strong>Saída:</strong> {operation.output||"Não documentada"}</p>
      </section>}
      {tab==="api"&&<section className="operation-part">
        <div className="operation-part-title"><FileCode2 size={16}/><h4>Superfície de API</h4></div>
        {crmRoutes.filter(route=>route.actionId===operation.id).length>0&&<div className="evidence-scroll" role="region" aria-label="Rotas desta ação" tabIndex={0}><table className="evidence-table"><thead><tr><th>Verbo</th><th>Rota</th><th>Permissão de referência</th></tr></thead><tbody>{crmRoutes.filter(route=>route.actionId===operation.id).map(route=><tr key={route.method+route.path}><td><code>{route.method}</code></td><td><code>{route.path}</code></td><td>{route.permission}</td></tr>)}</tbody></table></div>}
        <dl className="operation-contract"><div><dt>Rota HTTP declarada</dt><dd><code>{operation.contract?.http||"Não documentada"}</code></dd></div><div><dt>Método interno</dt><dd><code>{operation.contract?.method||"Não documentado"}</code></dd></div></dl>
        <Unverified>Não inferir schemas, códigos HTTP, autenticação ou estabilidade pública além das referências verificadas.</Unverified>
      </section>}
      {tab==="seguranca"&&<section className="operation-part">
        <div className="operation-part-title"><ShieldCheck size={16}/><h4>Autorização e isolamento</h4></div>
        <p><strong>Permissão declarada:</strong> {operation.contract?.permission||"Não documentada"}</p>
        {operation.rules?.length?<ul className="operation-rules">{operation.rules.map((rule,i)=><li key={i}>{rule}</li>)}</ul>:<Unverified/>}
        <p className="operation-evidence-note">Confirmar identidade confiável, tenant scope e políticas no código e nos testes antes de homologar.</p>
      </section>}
      {tab==="testes"&&<section className="operation-part">
        <div className="operation-part-title"><Check size={16}/><h4>Critérios de aceite a verificar</h4></div>
        {operation.acceptance?.length?<ul className="operation-checklist">{operation.acceptance.map((criterion,i)=><li key={i}><span className="criterion-box" aria-hidden="true"/> {criterion}</li>)}</ul>:<Unverified/>}
        <p className="operation-evidence-note">Critério listado não significa teste executado ou aprovado.</p>
      </section>}
      {tab==="operacao"&&<section className="operation-part">
        <div className="operation-part-title"><ShieldCheck size={16}/><h4>Operação e evidências</h4></div>
        <p>{operation.evidence||"Não documentado."}</p>
        <Unverified>Ambiente de execução, métricas, alertas, reprocessamento e runbook exigem evidências próprias.</Unverified>
      </section>}
      {tab==="pendencias"&&<section className="operation-part operation-agent">
        <div className="operation-part-title"><ClipboardCopy size={16}/><h4>Próximo trabalho focado</h4></div>
        <p>{operation.task||"Não documentado."}</p>
        <p>Briefing para revisão, não autorização automática para implementação, migrations ou deploy.</p>
        <div className="proposal-actions"><button className="action-ghost" type="button" onClick={copy}><ClipboardCopy size={14} style={{display:"inline",marginRight:6}}/>Copiar briefing técnico</button><button className="action-ghost" type="button" onClick={download}><Download size={14} style={{display:"inline",marginRight:6}}/>Exportar briefing .md</button></div>
        {feedback&&<p className="proposal-feedback" role="status">{feedback}</p>}
        <div className="pilot-prompt-buttons">
          <button type="button" className="action-ghost" onClick={async()=>{try{await navigator.clipboard.writeText(crmWorkPrompt(operation,"planning"));setFeedback("Prompt de planejamento copiado.");}catch{setFeedback("Cópia bloqueada. Use exportação Markdown.");}}}>Planejar alteração</button>
          <button type="button" className="action-ghost" onClick={async()=>{try{await navigator.clipboard.writeText(crmWorkPrompt(operation,"implementation"));setFeedback("Prompt de implementação copiado.");}catch{setFeedback("Cópia bloqueada. Use exportação Markdown.");}}}>Implementar alteração aprovada</button>
          <button type="button" className="action-ghost" onClick={()=>{const url=URL.createObjectURL(new Blob([crmWorkPrompt(operation,"planning")],{type:"text/markdown;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="syndes-crm-"+operation.id+"-planejamento.md";a.click();URL.revokeObjectURL(url);}}>Exportar planejamento .md</button>
          <button type="button" className="action-ghost" onClick={()=>{const url=URL.createObjectURL(new Blob([crmWorkPrompt(operation,"implementation")],{type:"text/markdown;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="syndes-crm-"+operation.id+"-implementacao.md";a.click();URL.revokeObjectURL(url);}}>Exportar implementação .md</button>
        </div>
        <ProposalEditor moduleId="P01" sectionId={operation.id} sectionTitle={operation.title} sourceLink={operation.sources?.[0]?.url||""}/>
      </section>}
    </div>
    <footer className="source-footer" aria-label={"Fontes da operação "+operation.title}>
      <span className="source-label">Fontes e registros originais</span>
      <a className="operation-action-dossier" href={"https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/acoes/"+operation.id+".md"} target="_blank" rel="noopener noreferrer">Ficha completa da ação <ArrowUpRight size={12}/></a>
      <div className="source-links">{(operation.sources||[]).map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.label}<ArrowUpRight size={12}/></a>)}</div>
    </footer>
  </section>;
}
