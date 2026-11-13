"use client";
import { useEffect, useState } from "react";
import { Box, Button, Textarea } from "@chakra-ui/react";
import { MessageSquarePlus, Copy, Download, X } from "lucide-react";

export default function ProposalEditor({moduleId,sectionId,sectionTitle,sourceLink}) {
  const storageKey="syndes-docs-reader-v1:"+moduleId+":"+sectionId;
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState("");
  const [detail,setDetail]=useState("");
  const [feedback,setFeedback]=useState("");
  const [loaded,setLoaded]=useState(false);
  useEffect(()=>{
    try {
      const value=localStorage.getItem(storageKey);
      if(value){const state=JSON.parse(value);setTitle(state.title||"");setDetail(state.detail||"");}
    } catch {}
    setLoaded(true);
  },[storageKey]);
  useEffect(()=>{
    if(!loaded)return;
    try {if(title.trim()||detail.trim())localStorage.setItem(storageKey,JSON.stringify({title,detail,sectionId,moduleId,updatedAt:new Date().toISOString()}));
    else localStorage.removeItem(storageKey);}catch{}
  },[loaded,storageKey,title,detail,sectionId,moduleId]);
  const compose=()=>[
    "# Proposta de melhoria — "+moduleId+" / "+sectionTitle,
    "Assunto: "+(title.trim()||"Sem título"),
    "",
    detail.trim()||"(Descrição ainda não preenchida)",
    "",
    "Referência: "+sourceLink,
    "",
    "Estado: RASCUNHO — não aprovado, não implementado.",
    "Verificar contexto, impactos e critérios de aceite antes de executar."
  ].join("\n");
  const copy=async()=>{try{await navigator.clipboard.writeText(compose());setFeedback("Texto copiado para revisão com IA.");}catch{setFeedback("Cópia bloqueada pelo navegador. Use Exportar .md.");}};
  const download=()=>{const url=URL.createObjectURL(new Blob([compose()],{type:"text/markdown;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=moduleId.toLowerCase()+"-"+sectionId+"-proposta.md";a.click();URL.revokeObjectURL(url);setFeedback("Arquivo Markdown exportado.");};
  return <div className="proposal-area">
    <button type="button" className="proposal-trigger" aria-expanded={open} aria-controls={"proposal-"+sectionId} onClick={()=>setOpen(!open)}><MessageSquarePlus size={15}/>{title.trim()||detail.trim()?"Revisar proposta em rascunho":"Sugerir melhoria nesta seção"}</button>
    {open&&<div id={"proposal-"+sectionId} className="proposal-panel">
      <Box display="flex" justifyContent="space-between" gap="3" alignItems="center">
        <h3>O que precisa melhorar?</h3>
        <button type="button" aria-label="Fechar proposta" onClick={()=>setOpen(false)}><X size={17}/></button>
      </Box>
      <p className="proposal-help">Registre a ideia com suas palavras. O rascunho fica somente neste navegador; não envia dados ao servidor nem implementa mudanças automaticamente.</p>
      <label htmlFor={"proposal-title-"+sectionId} className="eyebrow" style={{marginBottom:9}}>Título da proposta</label>
      <input id={"proposal-title-"+sectionId} className="proposal-input" placeholder="Ex.: Diferenciar contato de organização" value={title} onChange={e=>setTitle(e.target.value)} maxLength={160}/>
      <label htmlFor={"proposal-detail-"+sectionId} className="eyebrow" style={{marginTop:16}}>Descrição e resultado esperado</label>
      <Textarea id={"proposal-detail-"+sectionId} className="proposal-input proposal-textarea" placeholder="Descreva a alteração, por que é necessária, riscos e como saberemos que deu certo…" value={detail} onChange={e=>setDetail(e.target.value)} rows={6}/>
      <div className="proposal-actions">
        <button className="action-filled" type="button" onClick={copy}><Copy size={13} style={{display:"inline",marginRight:6}}/>Copiar para revisão com IA</button>
        <button className="action-ghost" type="button" onClick={download}><Download size={13} style={{display:"inline",marginRight:6}}/>Exportar .md</button>
      </div>
      {feedback&&<p role="status" className="proposal-feedback">{feedback}</p>}
      <p className="draft-note">{loaded?"Rascunho salvo apenas neste navegador.":"Abrindo rascunho…"} Para registrar formalmente, exporte o Markdown e encaminhe para revisão no GitHub.</p>
    </div>}
  </div>;
}
