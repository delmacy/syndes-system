"use client";
import { useState } from "react";
import { ArrowUpRight, Check, ClipboardCopy, FileCode2, ShieldCheck, TableProperties } from "lucide-react";
import ProposalEditor from "./proposal-editor";

export function agentBrief(operation) {
  const lines=[
    "# Syndes / P01 CRM — tarefa focada",
    "Operação: "+operation.title+" ("+operation.id+")",
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
export default function OperationDetail({operation}) {
  const [feedback,setFeedback]=useState("");
  const copy=async()=>{
    try {await navigator.clipboard.writeText(agentBrief(operation));setFeedback("Briefing copiado para revisão por um agente.");}
    catch {setFeedback("O navegador bloqueou a cópia. Use a exportação do rascunho ou copie manualmente.");}
  };
  return <section className="operation-detail" aria-labelledby="operation-title" id={operation.id}>
    <div className="operation-head">
      <div>
        <span className="eyebrow">OPERAÇÃO · {operation.kind}</span>
        <h3 id="operation-title">{operation.title}</h3>
      </div>
      <span className="operation-status">{operation.state}</span>
    </div>
    <p className="operation-purpose">{operation.objective}</p>
    <section className="operation-part" aria-labelledby="operation-flow">
      <div className="operation-part-title"><Check size={16}/><h4 id="operation-flow">Como funciona</h4></div>
      <ol className="operation-steps">{operation.behavior.map((step,i)=><li key={i}>{step}</li>)}</ol>
    </section>
    <section className="operation-part" aria-labelledby="operation-inputs">
      <div className="operation-part-title"><TableProperties size={16}/><h4 id="operation-inputs">Entradas e resultado</h4></div>
      <div className="evidence-scroll" role="region" tabIndex={0} aria-label="Entradas da operação">
        <table className="evidence-table">
          <thead><tr><th scope="col">Campo</th><th scope="col">Regra encontrada</th></tr></thead>
          <tbody>{operation.inputs.map(([name,rule])=><tr key={name}><td><code>{name}</code></td><td>{rule}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="operation-result"><strong>Resultado:</strong> {operation.output}</p>
    </section>
    <section className="operation-part">
      <div className="operation-part-title"><ShieldCheck size={16}/><h4>Regras e limites</h4></div>
      <ul className="operation-rules">{operation.rules.map((rule,i)=><li key={i}>{rule}</li>)}</ul>
    </section>
    <details className="operation-expander">
      <summary>Contratos, dados e evidências técnicas <FileCode2 size={16}/></summary>
      <div className="operation-expander-body">
        <dl className="operation-contract">
          <div><dt>Classe ou método</dt><dd><code>{operation.contract.method}</code></dd></div>
          <div><dt>Rota HTTP declarada</dt><dd><code>{operation.contract.http}</code></dd></div>
          <div><dt>Permissão</dt><dd>{operation.contract.permission}</dd></div>
          <div><dt>Dados</dt><dd>{operation.contract.data}</dd></div>
        </dl>
        <p>{operation.evidence}</p>
      </div>
    </details>
    <details className="operation-expander operation-agent">
      <summary>Critérios de aceite e briefing para agente <ClipboardCopy size={16}/></summary>
      <div className="operation-expander-body">
        <p>Esta é uma delimitação de trabalho, não uma autorização automática de implementação.</p>
        <ul className="operation-checklist">{operation.acceptance.map((criterion,i)=><li key={i}><span className="criterion-box" aria-hidden="true"/> {criterion}</li>)}</ul>
        <p><strong>Próxima ação sugerida:</strong> {operation.task}</p>
        <button className="action-ghost" type="button" onClick={copy}><ClipboardCopy size={14} style={{display:"inline",marginRight:6}}/>Copiar briefing técnico</button>
        {feedback&&<p className="proposal-feedback" role="status">{feedback}</p>}
      </div>
    </details>
    <footer className="source-footer" aria-label={"Fontes da operação "+operation.title}>
      <span className="source-label">Fontes e registros originais</span>
      <div className="source-links">{operation.sources.map(s=><a href={s.url} key={s.url} target="_blank" rel="noopener noreferrer">{s.label}<ArrowUpRight size={12}/></a>)}</div>
    </footer>
    <ProposalEditor moduleId="P01" sectionId={operation.id} sectionTitle={operation.title} sourceLink={operation.sources[0]?.url||""}/>
  </section>;
}
