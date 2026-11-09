import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {autoLoginAllowed,beginLogin,finishLogin,markSignedOut,readConfig,type SupportConfig} from "./auth.js";
import {ALLOWED_NEXT,PRIORITIES,QUEUES,STATUSES,SupportApi,
 type CasePriority,type CaseStatus,type CaseFilters,type CaseEvent,type InboxConversation,
 type SupportCase,type SupportKind} from "./api.js";

const audienceLabel:Record<SupportKind,string>={external:"Atendimento externo",internal:"Solicitações internas"};
const statusLabel:Record<CaseStatus,string>={
 new:"Novo",triage:"Triagem",in_progress:"Em andamento",waiting_customer:"Aguardando solicitante",
 resolved:"Resolvido",closed:"Fechado"
};
const priorityLabel:Record<CasePriority,string>={low:"Baixa",normal:"Normal",high:"Alta",critical:"Crítica"};
const date=(v:string|null)=>v?new Date(v).toLocaleString("pt-BR"):"—";
const errorText=(e:unknown)=>e instanceof Error?e.message:"Operação indisponível.";

export default function App(){
 const [config,setConfig]=useState<SupportConfig|null>(null);
 const [token,setToken]=useState<string|null>(null);
 const [booting,setBooting]=useState(true);
 const [accessError,setAccessError]=useState("");
 const [kind,setKind]=useState<SupportKind>("internal");
 const [filters,setFilters]=useState<CaseFilters>({});
 const [items,setItems]=useState<SupportCase[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [selected,setSelected]=useState<SupportCase|null>(null);
 const [history,setHistory]=useState<CaseEvent[]>([]);
 const [loading,setLoading]=useState(false);
 const [detailLoading,setDetailLoading]=useState(false);
 const [notice,setNotice]=useState("");
 const [operationError,setOperationError]=useState("");
 const [busy,setBusy]=useState(false);
 const [showCreate,setShowCreate]=useState(false);
 const [createQueue,setCreateQueue]=useState("it_infra");
 const [createPriority,setCreatePriority]=useState<CasePriority>("normal");
 const [createDescription,setCreateDescription]=useState("");
 const [createConversation,setCreateConversation]=useState("");
 const [conversations,setConversations]=useState<InboxConversation[]>([]);
 const [conversationsLoading,setConversationsLoading]=useState(false);
 const [statusValue,setStatusValue]=useState<CaseStatus>("triage");
 const [assignee,setAssignee]=useState("");
 const [destinationQueue,setDestinationQueue]=useState("");
 const [note,setNote]=useState("");
 const listRequest=useRef<AbortController|null>(null);
 const detailRequest=useRef<AbortController|null>(null);
 const conversationRequest=useRef<AbortController|null>(null);
 const activeKind=useRef<SupportKind>("internal");
 const operationEpoch=useRef(0);
 const abortReads=useCallback(()=>{
  listRequest.current?.abort();detailRequest.current?.abort();conversationRequest.current?.abort();
 },[]);
 useEffect(()=>()=>abortReads(),[abortReads]);

 const signOut=useCallback(()=>{
  ++operationEpoch.current;
  abortReads();markSignedOut();setToken(null);setItems([]);setSelected(null);setSelectedId(null);
  setHistory([]);setNotice("");setShowCreate(false);setLoading(false);setDetailLoading(false);setBusy(false);
 },[abortReads]);
 const api=useMemo(()=>config&&token?new SupportApi(config.tenantId,token,signOut):null,[config,token,signOut]);
 useEffect(()=>{
  let mounted=true;
  void (async()=>{
   try{
    const cfg=await readConfig();
    if(!mounted)return;
    setConfig(cfg);
    const jwt=await finishLogin(cfg);
    if(!mounted)return;
    if(jwt){setToken(jwt);return;}
    if(autoLoginAllowed())await beginLogin(cfg);
   }catch(e){if(mounted)setAccessError(errorText(e));}
   finally{if(mounted)setBooting(false);}
  })();
  return()=>{mounted=false;};
 },[]);
 const switchKind=(next:SupportKind)=>{
  if(next===activeKind.current)return;
  // Invalidate requests synchronously, before the new audience can render.
  activeKind.current=next;++operationEpoch.current;abortReads();
  setItems([]);setSelectedId(null);setSelected(null);setHistory([]);
  setFilters({});setShowCreate(false);setConversations([]);
  setLoading(false);setDetailLoading(false);setConversationsLoading(false);setBusy(false);
  setOperationError("");setNotice("");setKind(next);
 };
 const loadCases=useCallback(async()=>{
  if(!api||activeKind.current!==kind)return;
  listRequest.current?.abort();
  const controller=new AbortController();listRequest.current=controller;
  setLoading(true);setOperationError("");
  try{
   const result=await api.cases(kind,filters,controller.signal);
   if(result.some(c=>c.kind!==kind))throw Error("Resposta de atendimento fora do contexto selecionado.");
   if(!controller.signal.aborted&&activeKind.current===kind)setItems(result);
  }catch(e){if(!controller.signal.aborted&&activeKind.current===kind){
   setItems([]);setOperationError(errorText(e));
  }}finally{
   if(!controller.signal.aborted&&activeKind.current===kind)setLoading(false);
   if(listRequest.current===controller)listRequest.current=null;
  }
 },[api,kind,filters]);
 useEffect(()=>{void loadCases();return()=>{listRequest.current?.abort();};},[loadCases]);
 const loadDetail=useCallback(async(id:string)=>{
  if(!api||activeKind.current!==kind)return;
  detailRequest.current?.abort();
  const controller=new AbortController();detailRequest.current=controller;
  setDetailLoading(true);setOperationError("");
  try{
   const [value,events]=await Promise.all([api.get(kind,id,controller.signal),api.events(kind,id,controller.signal)]);
   if(value.kind!==kind||value.id!==id)throw Error("Detalhe fora do contexto selecionado.");
   if(controller.signal.aborted||activeKind.current!==kind)return;
   setSelected(value);setHistory(events);
   setStatusValue(ALLOWED_NEXT[value.status][0]??"triage");
   setAssignee(value.assignedTo??"");
   setDestinationQueue(QUEUES[kind].find(q=>q.code!==value.queue)?.code??value.queue);
  }catch(e){if(!controller.signal.aborted&&activeKind.current===kind){
   setSelected(null);setHistory([]);setOperationError(errorText(e));
  }}finally{
   if(!controller.signal.aborted&&activeKind.current===kind)setDetailLoading(false);
   if(detailRequest.current===controller)detailRequest.current=null;
  }
 },[api,kind]);
 useEffect(()=>{
  if(!selectedId){detailRequest.current?.abort();setSelected(null);setHistory([]);setDetailLoading(false);return;}
  void loadDetail(selectedId);
  return()=>{detailRequest.current?.abort();};
 },[selectedId,loadDetail]);
 const modify=async(action:()=>Promise<unknown>,message:string)=>{
  const requestKind=kind,requestEpoch=++operationEpoch.current;
  const stillCurrent=()=>activeKind.current===requestKind&&operationEpoch.current===requestEpoch;
  setBusy(true);setOperationError("");setNotice("");
  try{
   await action();
   if(!stillCurrent())return false;
   setNotice(message);
   await loadCases();
   if(stillCurrent()&&selectedId)await loadDetail(selectedId);
   return stillCurrent();
  }catch(e){if(stillCurrent())setOperationError(errorText(e));return false;}
  finally{if(operationEpoch.current===requestEpoch)setBusy(false);}
 };
 const openCreate=async()=>{
  setShowCreate(true);setOperationError("");
  if(kind!=="external"||!api)return;
  conversationRequest.current?.abort();
  const controller=new AbortController();conversationRequest.current=controller;
  setConversationsLoading(true);setConversations([]);setCreateConversation("");
  try{
   const result=await api.whatsappConversations(controller.signal);
   if(!controller.signal.aborted&&activeKind.current==="external")setConversations(result);
  }catch(e){if(!controller.signal.aborted&&activeKind.current==="external")setOperationError(errorText(e));}
  finally{
   if(!controller.signal.aborted&&activeKind.current==="external")setConversationsLoading(false);
   if(conversationRequest.current===controller)conversationRequest.current=null;
  }
 };
 async function create(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!api)return;
  let createdId:string|null=null;
  const created=await modify(async()=>{
   const result=kind==="internal"
    ?await api.createInternal(createQueue,createPriority,createDescription)
    :await api.createExternal(createConversation,createPriority);
   createdId=result.id;
  },"Chamado registrado.");
  if(created&&createdId){
   // A response from a previous audience must not select a case in this one.
   setSelectedId(createdId);setShowCreate(false);setCreateDescription("");setCreateConversation("");
  }
 }
 if(booting)return <main className="center" role="status">Carregando autenticação da Syndes…</main>;
 if(!config||accessError)return <main className="center"><h1>Syndes Support</h1><p role="alert">{accessError||"Configuração indisponível."}</p></main>;
 if(!token)return <main className="center">
  <h1>Syndes Support</h1><p>Atendimento exclusivo da operação Syndes.</p>
  <p>Entre com sua identidade autorizada para consultar os chamados.</p>
  <button onClick={()=>{void beginLogin(config).catch(e=>setAccessError(errorText(e)));}}>Entrar com Keycloak</button>
  {accessError&&<p role="alert">{accessError}</p>}
 </main>;
 return <div className="app">
  <header className="topbar">
   <div><strong>Syndes Support</strong><small>{config.tenantLabel} · Central de Atendimento</small></div>
   <button className="subtle" onClick={signOut}>Sair</button>
  </header>
  <div className="workarea">
   <nav aria-label="Público do atendimento" className="audiences">
    {(["external","internal"] as const).map(k=><button key={k} className={kind===k?"current":""}
      aria-current={kind===k?"page":undefined} onClick={()=>switchKind(k)}>
      {audienceLabel[k]}</button>)}
   </nav>
   <div className="title-row">
    <div><h1>{audienceLabel[kind]}</h1><p>{kind==="external"?"Chamados vinculados a conversas WhatsApp e contatos Syndes.":"Solicitações autenticadas dos colaboradores."}</p></div>
    <button onClick={()=>{void openCreate();}}>Novo chamado</button>
   </div>
   {notice&&<div className="message success" role="status">{notice}</div>}
   {operationError&&<div className="message error" role="alert">{operationError}</div>}
   {showCreate&&<section className="panel create" aria-label="Criar chamado">
    <div className="section-title"><h2>Registrar chamado {kind==="internal"?"interno":"externo"}</h2><button className="subtle" onClick={()=>setShowCreate(false)}>Cancelar</button></div>
    <form onSubmit={e=>{void create(e);}} className="create-form">
     {kind==="internal"?<>
      <label>Fila
       <select value={createQueue} onChange={e=>setCreateQueue(e.target.value)}>
        {QUEUES.internal.map(q=><option key={q.code} value={q.code}>{q.label}</option>)}
       </select></label>
      <label className="full">Descrição
       <textarea required maxLength={5000} minLength={1} value={createDescription}
        onChange={e=>setCreateDescription(e.target.value)} placeholder="Descreva a solicitação" rows={3}/>
      </label>
     </>:<label className="full">Conversa WhatsApp com CRM vinculado
      <select required value={createConversation} disabled={conversationsLoading}
       onChange={e=>setCreateConversation(e.target.value)}>
       <option value="">{conversationsLoading?"Consultando Inbox…":"Selecione uma conversa"}</option>
       {conversations.map(c=><option value={c.id} key={c.id}>{c.subject}</option>)}
      </select>
      {!conversationsLoading&&conversations.length===0&&<small>Nenhuma conversa elegível encontrada entre as 100 mais recentes. O vínculo e a conta Syndes são verificados pelo backend.</small>}
     </label>}
     <label>Prioridade
      <select value={createPriority} onChange={e=>setCreatePriority(e.target.value as CasePriority)}>
       {PRIORITIES.map(p=><option value={p} key={p}>{priorityLabel[p]}</option>)}
      </select></label>
     <button disabled={busy||kind==="external"&&!createConversation} type="submit">
      {busy?"Registrando…":"Registrar"}
     </button>
    </form>
   </section>}
   <section className="filters" aria-label="Filtros de chamados">
    <label>Fila<select value={filters.queue??""} onChange={e=>setFilters(v=>({...v,queue:e.target.value||undefined}))}>
     <option value="">Todas as filas autorizadas</option>
     {QUEUES[kind].map(q=><option key={q.code} value={q.code}>{q.label}</option>)}
    </select></label>
    <label>Estado<select value={filters.status??""} onChange={e=>setFilters(v=>({...v,status:(e.target.value||undefined) as CaseStatus|undefined}))}>
     <option value="">Todos os estados</option>
     {STATUSES.map(s=><option value={s} key={s}>{statusLabel[s]}</option>)}
    </select></label>
    <label>Prioridade<select value={filters.priority??""} onChange={e=>setFilters(v=>({...v,priority:(e.target.value||undefined) as CasePriority|undefined}))}>
     <option value="">Todas</option>
     {PRIORITIES.map(p=><option value={p} key={p}>{priorityLabel[p]}</option>)}
    </select></label>
    <button className="subtle" disabled={loading} onClick={()=>{void loadCases();}}>Atualizar lista</button>
   </section>
   <div className="two-col">
    <section className="panel cases" aria-label="Lista de chamados">
     <div className="section-title"><h2>Chamados</h2><small>{loading?"Carregando…":items.length+" nesta página"}</small></div>
     {items.length===0&&!loading&&<p className="empty">Nenhum chamado encontrado para este acesso e filtros.</p>}
     <ul className="case-list">
      {items.map(c=><li key={c.id}><button className={selectedId===c.id?"chosen":""}
       onClick={()=>{setNotice("");setSelectedId(c.id);}}>
        <span className="case-head"><strong>{c.protocol}</strong><span className="status">{statusLabel[c.status]}</span></span>
        <span>{QUEUES[kind].find(q=>q.code===c.queue)?.label??c.queue}</span>
        <small>{priorityLabel[c.priority]} · {date(c.updatedAt)}</small>
       </button></li>)}
     </ul>
     <div className="pagination">
      <button className="subtle" disabled={!filters.offset||filters.offset==="0"||loading}
       onClick={()=>setFilters(v=>({...v,offset:String(Math.max(0,Number(v.offset??"0")-30))}))}>Anterior</button>
      <span>Página {Math.floor(Number(filters.offset??"0")/30)+1}</span>
      <button className="subtle" disabled={loading||items.length<30}
       onClick={()=>setFilters(v=>({...v,offset:String(Number(v.offset??"0")+30)}))}>Próxima</button>
     </div>
    </section>
    <section className="panel details" aria-label="Detalhe do chamado">
     {detailLoading?<p role="status">Carregando chamado…</p>:
      !selected?<p className="empty">Selecione um chamado para consultar seus detalhes e histórico.</p>:<>
      <div className="section-title"><h2>{selected.protocol}</h2><span className="status">{statusLabel[selected.status]}</span></div>
      <dl className="case-fields">
       <div><dt>Fila</dt><dd>{QUEUES[kind].find(q=>q.code===selected.queue)?.label??selected.queue}</dd></div>
       <div><dt>Prioridade</dt><dd>{priorityLabel[selected.priority]}</dd></div>
       <div><dt>Solicitante</dt><dd>{selected.requesterId}</dd></div>
       <div><dt>Responsável</dt><dd>{selected.assignedTo??"Não atribuído"}</dd></div>
       <div><dt>Canal</dt><dd>{selected.channel==="form"?"Formulário interno":"WhatsApp"}</dd></div>
       <div><dt>Registrado</dt><dd>{date(selected.createdAt)}</dd></div>
      </dl>
      {selected.canOperate&&<div className="actions">
       <h3>Ações da fila</h3>
       {ALLOWED_NEXT[selected.status].length>0&&<form onSubmit={e=>{e.preventDefault();void modify(()=>api!.changeStatus(kind,selected.id,statusValue),"Estado atualizado.");}}>
        <label>Alterar estado<select value={statusValue} onChange={e=>setStatusValue(e.target.value as CaseStatus)}>
         {ALLOWED_NEXT[selected.status].map(s=><option value={s} key={s}>{statusLabel[s]}</option>)}
        </select></label><button disabled={busy} type="submit">Aplicar</button>
       </form>}
       {selected.status!=="closed"&&selected.status!=="resolved"&&<form onSubmit={e=>{e.preventDefault();void modify(()=>api!.assign(kind,selected.id,assignee),"Responsável atualizado.");}}>
        <label>Responsável<input required maxLength={256} value={assignee} onChange={e=>setAssignee(e.target.value)} placeholder="ID do usuário Keycloak"/></label>
        <button disabled={busy||!assignee.trim()} type="submit">Atribuir</button>
       </form>}
       {QUEUES[kind].length>1&&selected.status!=="closed"&&selected.status!=="resolved"&&
        <form onSubmit={e=>{e.preventDefault();void modify(()=>api!.transfer(kind,selected.id,destinationQueue),"Fila alterada.");}}>
         <label>Transferir para<select value={destinationQueue} onChange={e=>setDestinationQueue(e.target.value)}>
          {QUEUES[kind].filter(q=>q.code!==selected.queue).map(q=><option value={q.code} key={q.code}>{q.label}</option>)}
         </select></label><button disabled={busy||!destinationQueue||destinationQueue===selected.queue} type="submit">Transferir</button>
        </form>}
       <form className="note-form" onSubmit={e=>{e.preventDefault();void modify(()=>api!.note(kind,selected.id,note),"Nota interna registrada.").then(ok=>{if(ok)setNote("");});}}>
        <label>Nota interna (não enviada ao cliente)
         <textarea required maxLength={5000} value={note} onChange={e=>setNote(e.target.value)} rows={2}/>
        </label><button disabled={busy||!note.trim()} type="submit">Salvar nota</button>
       </form>
      </div>}
      <div className="history"><h3>Histórico</h3>
       {history.length===0?<p className="empty">Nenhuma ação registrada.</p>:<ol>{history.map(e=>
        <li key={e.id}><div><strong>{e.action.replaceAll("_"," ")}</strong><small>{date(e.recordedAt)} · {e.actorId}</small></div>
         {e.body&&<p>{e.body}</p>}{e.nextStatus&&<small>Estado: {e.nextStatus}</small>}
        </li>)}</ol>}
      </div>
     </>}
    </section>
   </div>
  </div>
 </div>;
}
