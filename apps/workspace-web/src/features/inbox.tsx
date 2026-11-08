import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft, Bot, CircleCheck, LoaderCircle,
  MessageCircle, Plus, RefreshCw, Search, Send, UserMinus, UserRoundCheck,
  UsersRound, StickyNote, FlaskConical, UserRoundPlus, PanelRightOpen,
  Star, Users, Archive, History, MailOpen, Pencil, MoreHorizontal, SlidersHorizontal,
  Inbox as InboxIcon, UserCheck, UserX, ListFilter, Clock3, CircleDot, Check, CheckCheck, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { InboxInspectorPanel } from "@/features/inbox-context";
import { WhatsAppAvatar } from "@/features/whatsapp-avatar";
import { reconcileInboxThread } from "@/features/inbox-thread";
import { isMine, replyBlockReason } from "@/features/inbox-rules";
import { clearSentDraft, draftKey, setDraft, type ComposerMode } from "@/features/inbox-drafts";
import type { Conversation, Message, Person, TenantApi, QueueFilter, WhatsAppGroupInfo } from "@/lib/api";

type Status = Conversation["status"];
const FALLBACK_INTERVAL_MS = 10_000;
const statusLabel: Record<Status, string> = { open: "Aberta", pending: "Pendente", resolved: "Resolvida" };
const statusVariant: Record<Status, "secondary" | "outline" | "default"> = {
  open: "secondary", pending: "outline", resolved: "default",
};
const composerModes: { value: ComposerMode; label: string; icon: typeof Send }[] = [
  { value: "replies", label: "Resposta", icon: Send },
  { value: "notes", label: "Nota interna", icon: StickyNote },
  { value: "simulator/inbound", label: "Simular entrada", icon: FlaskConical },
];
function timeLabel(date: string | undefined): string {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  return value.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function inboxCallerLabel(record:Pick<Conversation,"channel"|"phoneNumber"|"subject"|"isGroup"|"displayName">):string{
  if(record.channel!=="whatsapp"||record.isGroup)return record.subject;
  if(typeof record.displayName==="string"&&record.displayName.trim())return record.displayName.trim();
  // Whatsmeow history snapshots can supply the contact's chat title even
  // when it has not been explicitly saved in our WhatsApp address book.
  // Never display an internal placeholder as a person's name.
  const syncedTitle=record.subject?.trim();
  if(syncedTitle && !/^WhatsApp\s*·/i.test(syncedTitle) &&
      syncedTitle!=="Contato sem número disponível" && syncedTitle!=="Número não disponível" &&
      syncedTitle!=="Grupo WhatsApp")return syncedTitle;
  const number=record.phoneNumber;
  if(!number||!/^\+[1-9][0-9]{9,14}$/.test(number))return "Número não disponível";
  const d=number.slice(1);
  if(d.startsWith("55")&&d.length===13)return "+55 "+d.slice(2,4)+" "+d.slice(4,9)+"-"+d.slice(9);
  if(d.startsWith("55")&&d.length===12)return "+55 "+d.slice(2,4)+" "+d.slice(4,8)+"-"+d.slice(8);
  return number;
}

export function WhatsAppDeliveryIndicator({status}:{status?:Message["deliveryStatus"]}){
 if(!status)return null;
 const label=status==="read"?"Lida":status==="delivered"?"Entregue":
   status==="sent"?"Enviada pelo WhatsApp":status==="synced"?"Sincronizada do WhatsApp":
   status==="pending"?"Na fila de envio":status==="processing"?"Enviando pelo WhatsApp":
   status==="failed"?"Falha no envio; reenvio automático desativado":"Registro anterior sem confirmação do gateway";
 const Icon=status==="read"||status==="delivered"?CheckCheck:
   status==="sent"||status==="synced"?Check:
   status==="failed"?AlertCircle:Clock3;
 return <span role="status" aria-label={label} title={label} className={"inline-flex items-center gap-1 "+
   (status==="read"?"text-sky-200":status==="failed"?"text-rose-200":"text-white/85")}>
   <Icon className="size-3.5" aria-hidden="true"/>
   {(status==="failed"||status==="not_queued")&&<span className="text-[10px]">{label}</span>}
 </span>;
}

export function InboxFeature({ api, actorId, onOpenCrm }: { api: TenantApi; actorId: string; onOpenCrm: () => void }) {
  const [records, setRecords] = useState<Conversation[]>([]);
  const [sidebarTarget, setSidebarTarget] = useState<HTMLElement | null>(null);
  const [toolbarTarget, setToolbarTarget] = useState<HTMLElement | null>(null);
  const [scopeTab, setScopeTab] = useState<"phones" | "groups">("phones");
  useEffect(() => {
    setSidebarTarget(document.getElementById("syndes-inbox-sidebar"));
    setToolbarTarget(document.getElementById("syndes-inbox-toolbar"));
  }, []);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"" | Status>("");
  const [queue, setQueue] = useState<QueueFilter>("all");
  const [chatScope,setChatScope]=useState<"all"|"unread"|"favorites"|"groups"|"archived">("all");
  const [debouncedSearch,setDebouncedSearch]=useState("");
  const [moreAvailable,setMoreAvailable]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const [syncingHistory,setSyncingHistory]=useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState(false);
  const [listError, setListError] = useState(false);
  const [live, setLive] = useState(false);
  const [threadError, setThreadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const [composerMode, setComposerMode] = useState<ComposerMode>("replies");
  const [dialog, setDialog] = useState(false);
  const [subject, setSubject] = useState("");
  const [linkedPersonId, setLinkedPersonId] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [contactOpen,setContactOpen]=useState(false);
  const [contactName,setContactName]=useState("");
  const [contactPhone,setContactPhone]=useState("");
  const [contactExistingId,setContactExistingId]=useState("");
  const [contactMatches,setContactMatches]=useState<Person[]>([]);
  const [contactCreatedId,setContactCreatedId]=useState<string|null>(null);
  const [contactBusy,setContactBusy]=useState(false);
  const [nameEditorOpen,setNameEditorOpen]=useState(false);
  const [nameEditorValue,setNameEditorValue]=useState("");
  const [nameEditorPhone,setNameEditorPhone]=useState(false);
  const [nameEditorBusy,setNameEditorBusy]=useState(false);
  const [groupOpen,setGroupOpen]=useState(false);
  const [groupBusy,setGroupBusy]=useState(false);
  const [groupInfo,setGroupInfo]=useState<WhatsAppGroupInfo|null>(null);
  const [groupName,setGroupName]=useState("");
  const [groupDescription,setGroupDescription]=useState("");
  const [groupError,setGroupError]=useState("");


  const activeId = useRef<string | null>(null);
  const listRequest = useRef(0);
  const threadRequest = useRef(0);
  const busy = useRef(false);
  const messagesViewport=useRef<HTMLDivElement|null>(null);
  const initialScrollFor=useRef<string|null>(null);
  const stickToBottom=useRef(true);
  const onMessagesScroll=()=>{
    const el=messagesViewport.current;
    if(el)stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<=100;
  };
  useLayoutEffect(()=>{
    const el=messagesViewport.current;
    if(!el||!selected||reading)return;
    const first=initialScrollFor.current===selected.id;
    if(first||stickToBottom.current){
      el.scrollTop=el.scrollHeight;
      if(first)initialScrollFor.current=null;
      stickToBottom.current=true;
    }
  },[selected?.id,thread,reading]);


  useEffect(()=>{
   const timer=window.setTimeout(()=>setDebouncedSearch(search.trim()),300);
   return()=>window.clearTimeout(timer);
  },[search]);
  const refresh = useCallback(async (showLoading = false) => {
    const requestId = ++listRequest.current;
    if (showLoading) setLoading(true);
    try {
      const result = await api.conversations(filter,queue,chatScope,0,debouncedSearch);
      if (requestId !== listRequest.current) return;
      setRecords(result);
      setMoreAvailable(result.length===100);
      setListError(false);
      const current = result.find(item => item.id === activeId.current);
      if (current) setSelected(current);
    } catch (error) {
      if (requestId !== listRequest.current) return;
      setListError(true);
      if (showLoading) toast.error(error instanceof Error ? error.message : "Não foi possível consultar a fila.");
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  }, [api, filter, queue,chatScope,debouncedSearch]);

  const loadMore = async ()=>{
   if(loadingMore||!moreAvailable)return;
   setLoadingMore(true);
   const requestId=listRequest.current;
   try{
    const page=await api.conversations(filter,queue,chatScope,records.length,debouncedSearch);
    if(requestId!==listRequest.current)return;
    setRecords(previous=>{
     const known=new Set(previous.map(item=>item.id));
     return [...previous,...page.filter(item=>!known.has(item.id))];
    });
    setMoreAvailable(page.length===100);
   }catch(error){toast.error(error instanceof Error?error.message:"Falha ao carregar outras conversas.")}
   finally{setLoadingMore(false)}
  };
  const readThread = useCallback(async (id: string, showLoading = false) => {
    const requestId = ++threadRequest.current;
    if (showLoading) setReading(true);
    try {
      const [conversation, messages] = await Promise.all([api.conversation(id), api.messages(id)]);
      if (requestId !== threadRequest.current || activeId.current !== id) return;
      setSelected(conversation);
      // Receipt updates may arrive while the SSE stream stays connected.
      // Skip unchanged state to preserve scroll position and avoid rerenders.
      setThread(previous=>reconcileInboxThread(previous,messages) as Message[]);
      setThreadError(false);
    } catch (error) {
      if (requestId !== threadRequest.current || activeId.current !== id) return;
      setThreadError(true);
      if (showLoading) toast.error(error instanceof Error ? error.message : "Não foi possível abrir a conversa.");
    } finally {
      if (requestId === threadRequest.current && activeId.current === id) setReading(false);
    }
  }, [api]);

  useEffect(() => { void refresh(true); }, [refresh]);
  useEffect(() => {
    const abort = new AbortController();
    let liveStream=false;
    let retry:ReturnType<typeof setTimeout>|undefined;
    const reload = () => {
      if(document.visibilityState!=="visible" || busy.current)return;
      void refresh();
      if(activeId.current)void readThread(activeId.current);
    };
    const connect = async () => {
      while(!abort.signal.aborted){
        try {
          liveStream=true;setLive(true);
          await api.watchInbox(abort.signal,reload);
        }catch{
          // Fall back to polling: no message loss, no exposure of event payloads.
        }finally{
          liveStream=false;
          if(!abort.signal.aborted)setLive(false);
        }
        if(abort.signal.aborted)break;
        await new Promise<void>(resolve=>{
          retry=setTimeout(resolve,5000);
          abort.signal.addEventListener("abort",()=>{if(retry)clearTimeout(retry);resolve();},{once:true});
        });
      }
    };
    void connect();
    const timer = window.setInterval(()=>{if(!liveStream)reload();},FALLBACK_INTERVAL_MS);
    // Provider receipts (sent/delivered/read) update WhatsApp metadata without
    // necessarily creating a new Inbox message or SSE invalidation event.
    // Refresh an open chat even while the SSE connection is healthy.
    const receiptTimer=window.setInterval(()=>{
      if(document.visibilityState!=="visible"||busy.current)return;
      const current=activeId.current;
      if(current)void readThread(current);
    },8000);
    const visible = () => {if(document.visibilityState==="visible")reload();};
    document.addEventListener("visibilitychange",visible);
    return ()=>{
      abort.abort();
      if(retry)clearTimeout(retry);
      window.clearInterval(timer);
      window.clearInterval(receiptTimer);
      document.removeEventListener("visibilitychange",visible);
    };
  }, [api,refresh,readThread]);
  useEffect(() => () => {
    listRequest.current += 1;
    threadRequest.current += 1;
    activeId.current = null;
  }, [api]);

  const choose = (conversation: Conversation) => {
    activeId.current = conversation.id;
    initialScrollFor.current=conversation.id;
    stickToBottom.current=true;
    setSelected(conversation);
    setThread([]);
    setThreadError(false);
    setComposerMode("replies");
    setContextOpen(false);
    setContactOpen(false);
    setNameEditorOpen(false);
    void readThread(conversation.id, true);
    if(conversation.channel==="whatsapp"&&Number(conversation.unreadCount??0)>0){
      void api.markConversationRead(conversation.id).then(updated=>{
        setRecords(previous=>previous.map(c=>c.id===updated.id?{...c,unreadCount:0}:c));
        setSelected(current=>current?.id===updated.id?{...current,unreadCount:0}:current);
      }).catch(()=>{/* Reading remains available even without write permission. */});
    }
  };
  const closeMobileThread = () => {
    activeId.current = null;
    initialScrollFor.current=null;
    threadRequest.current += 1;
    setSelected(null);
    setThread([]);
    setReading(false);
    setContextOpen(false);
  };

  const mutate = async (action: () => Promise<Conversation>, success: string) => {
    if (busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      const result = await action();
      if (activeId.current === result.id) setSelected(result);
      await Promise.all([refresh(), readThread(result.id)]);
      toast.success(success);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a conversa.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  };
  const send = async () => {
    if (!selected || busy.current) return;
    const conversationId = selected.id;
    const mode = composerMode;
    const key = draftKey(conversationId, mode);
    const originalDraft = drafts[key] ?? "";
    const body = originalDraft.trim();
    if (!body) return;
    if (originalDraft.length > 5000) { toast.error("Limite de 5.000 caracteres por mensagem."); return; }
    if (mode !== "simulator/inbound" && replyBlockReason(selected, actorId)) return;
    busy.current = true;
    setSending(true);
    try {
      await api.message(conversationId, mode, {
        body,
        ...(mode === "simulator/inbound" ? { externalMessageId: crypto.randomUUID() } : {}),
      });
      setDrafts(previous => clearSentDraft(previous, key, originalDraft));
      await Promise.all([readThread(conversationId), refresh()]);
      toast.success(mode === "notes" ? "Nota interna registrada." : mode === "simulator/inbound" ? "Mensagem simulada recebida." : selected.channel === "whatsapp" ? "Resposta colocada na fila do WhatsApp." : "Resposta registrada.");
    } catch (error) {
      // Preserve draft on network errors, forbidden access or validation failures.
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  };
  const openContactDialog = (conv:Conversation) => {
    setContactName("");
    setContactPhone(conv.phoneNumber??"");
    setContactExistingId("");
    setContactCreatedId(null);
    setContactMatches([]);
    setContactOpen(true);
    if(conv.phoneNumber)void api.people(conv.phoneNumber,0,25).then(setContactMatches).catch(()=>{
      toast.info("A busca por contatos existentes não está disponível.");
    });
  };
  const saveContact = async () => {
    if(!selected||selected.channel!=="whatsapp"||contactBusy)return;
    if(!contactExistingId&&!contactCreatedId&&!contactName.trim())return;
    setContactBusy(true);
    try{
      let id=contactExistingId||contactCreatedId;
      if(!id){
        const data=await api.createPerson({
          name:contactName.trim(),...(contactPhone.trim()?{phone:contactPhone.trim()}:{}),
        });
        id=data.id;
        setContactCreatedId(id);
      }
      const linked=await api.linkConversationContact(selected.id,id);
      setSelected(linked);
      setRecords(previous=>previous.map(c=>c.id===linked.id?linked:c));
      setContactOpen(false);
      toast.success("Contato cadastrado e vinculado à conversa.");
      await refresh();
    }catch(error){
      toast.error(error instanceof Error?error.message:"Não foi possível vincular o contato.");
    }finally{setContactBusy(false)}
  };
  const openNameEditor=async(conv:Conversation)=>{
    if(conv.channel!=="whatsapp"||conv.isGroup||!conv.phoneNumber)return;
    setNameEditorPhone(false);
    setNameEditorValue(conv.displayName??"");
    setNameEditorOpen(true);
    if(conv.crmPersonId){
      try{
        const person=await api.person(conv.crmPersonId);
        if(activeId.current===conv.id)setNameEditorValue(person.name);
      }catch{
        toast.info("Nome do CRM indisponível. Verifique antes de salvar.");
      }
    }
  };
  const saveWhatsAppName=async()=>{
    if(!selected||nameEditorBusy||!nameEditorValue.trim())return;
    setNameEditorBusy(true);
    try{
      const response=await api.updateWhatsAppContactName(selected.id,nameEditorValue.trim(),nameEditorPhone);
      if(!response.submitted)throw Error("WhatsApp não aceitou a alteração.");
      const update=(entry:Conversation):Conversation=>entry.id===selected.id?{
        ...entry,displayName:response.fullName,contactNameSyncStatus:"submitted"
      }:entry;
      setSelected(current=>current?update(current):null);
      setRecords(previous=>previous.map(update));
      setNameEditorOpen(false);
      toast.info("Alteração enviada ao WhatsApp. Confira o nome no WhatsApp Web e no celular.");
    }catch(error){
      toast.error(error instanceof Error?error.message:"Não foi possível editar o nome no WhatsApp.");
    }finally{setNameEditorBusy(false)}
  };
  const openGroupInfo=async(conv:Conversation)=>{
    if(!conv.isGroup||conv.channel!=="whatsapp")return;
    setGroupOpen(true);setGroupBusy(true);setGroupInfo(null);setGroupError("");
    try{
      const info=await api.whatsappGroupInfo(conv.id);
      if(activeId.current!==conv.id)return;
      setGroupInfo(info);setGroupName(info.name);setGroupDescription(info.description);
    }catch(err){setGroupError(err instanceof Error?err.message:"Não foi possível consultar o grupo no WhatsApp.");}
    finally{setGroupBusy(false);}
  };
  const saveGroupField=async(field:"name"|"description")=>{
    if(!selected||!selected.isGroup||groupBusy||!groupInfo?.canEdit)return;
    setGroupBusy(true);setGroupError("");
    try{
      const response=await api.updateWhatsAppGroup(selected.id,
       field==="name"?{name:groupName}:{description:groupDescription});
      setGroupInfo(response);setGroupName(response.name);setGroupDescription(response.description);
      if(response.name&&selected.subject!==response.name){
        setSelected(current=>current?.id===selected.id?{...current,subject:response.name}:current);
        setRecords(previous=>previous.map(row=>row.id===selected.id?{...row,subject:response.name}:row));
      }
      toast.success("Estado confirmado pelo WhatsApp.");
    }catch(err){setGroupError(err instanceof Error?err.message:"O WhatsApp não confirmou a alteração.");}
    finally{setGroupBusy(false);}
  };
  const create = async () => {
    if (!subject.trim() || busy.current) return;
    busy.current = true;
    setSending(true);
    try {
      const record = await api.createConversation({ subject: subject.trim(), crmPersonId: linkedPersonId || null });
      setDialog(false);
      setSubject("");
      setLinkedPersonId("");
      setFilter("");
      setQueue("all");
      setChatScope("all");
      setRecords(previous => [record, ...previous.filter(item => item.id !== record.id)]);
      choose(record);
      if (!filter && queue === "all") void refresh();
      toast.success("Conversa criada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conversa.");
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  const currentDraftKey = selected ? draftKey(selected.id, composerMode) : "";
  const composer = drafts[currentDraftKey] ?? "";
  const updateComposer = (text: string) => setDrafts(previous => setDraft(previous, currentDraftKey, text));
  const matching=scopeTab === "phones" && chatScope === "all" ? records.filter(record=>!record.isGroup) : records; // Tenant-scoped query, with local phone/group tab separation.
  const replyReason = replyBlockReason(selected, actorId);
  const replyDisabled = composerMode !== "simulator/inbound" && Boolean(replyReason);
  const mine = isMine(selected, actorId);
  const showThread = Boolean(selected);
  const syncOlderHistory=async()=>{
    if(!selected||selected.channel!=="whatsapp"||syncingHistory)return;
    setSyncingHistory(true);
    try{
      const result=await api.requestConversationHistory(selected.id);
      toast.info(result.note);
    }catch(error){
      toast.error(error instanceof Error?error.message:"Não foi possível solicitar o histórico.");
    }finally{setSyncingHistory(false)}
  };
  const newConversation = () => {
    setSubject("");
    setLinkedPersonId("");
    setPeople([]);
    setDialog(true);
    void api.people().then(setPeople).catch(() => {
      toast.info("Contatos do CRM indisponíveis. Você pode criar uma conversa sem vínculo.");
    });
  };

  const renderQueue = (sidebar: boolean) => (
      <div className={(sidebar ? "flex syndes-inbox-queue-dark " : (showThread ? "hidden " : "flex ")) + "min-h-0 min-w-0 h-full overflow-hidden flex-col " + (sidebar ? "bg-transparent text-white" : "border-r border-border bg-white")}>
        <div className="shrink-0 space-y-2 border-b border-border p-3">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400"/><Input aria-label="Pesquisar conversas" className="h-9 pl-9" placeholder="Buscar conversas..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Tipo de conversa">
            {([["all","Telefones",MessageCircle],["groups","Grupos",Users]] as const).map(([value,label,Icon])=><button key={value} type="button" aria-pressed={chatScope===value} onClick={()=>{setScopeTab(value === "groups" ? "groups" : "phones");setChatScope(value)}} className={"flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium "+((scopeTab === "groups" ? "groups" : "all")===value?"bg-blue-600 text-white":"text-slate-600")}><Icon className="size-4"/>{label}</button>)}
          </div>
          <div className="grid w-full min-w-0 grid-cols-[4fr_1px_3fr_1px_4fr] items-center gap-1 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-1" aria-label="Filtros de conversas">
            <div role="group" aria-label="Filtros do WhatsApp" className="grid min-w-0 grid-cols-4 items-center justify-items-center gap-0.5">
              {([
                ["all","Todas",InboxIcon],["unread","Não lidas",MailOpen],
                ["favorites","Favoritas",Star],["archived","Arquivadas",Archive],
              ] as const).map(([value,label,Icon])=><button key={value} type="button" aria-label={label} title={label} aria-pressed={chatScope===value}
                onClick={()=>{setChatScope(value);setScopeTab("phones");}}
                className={"flex h-6 w-full max-w-6 min-w-0 items-center justify-center rounded-md transition-colors "+
                  (chatScope===value?"bg-blue-600 text-white shadow-sm":"text-slate-400 hover:bg-white/10 hover:text-white")}>
                <Icon className="size-4"/>
              </button>)}
            </div>
            <span className="h-5 w-px bg-white/15" aria-hidden="true"/>
            <div role="group" aria-label="Filtrar conversas por responsável" className="grid min-w-0 grid-cols-3 items-center justify-items-center gap-0.5">
              {([["mine","Minhas",UserCheck],["unassigned","Não atribuídas",UserX],["all","Todas as atribuições",Users]] as const).map(([value,label,Icon])=>
                <button type="button" key={value} title={label} aria-label={label} aria-pressed={queue===value}
                  className={"flex h-6 w-full max-w-6 min-w-0 items-center justify-center rounded-md transition-colors "+
                   (queue===value?"bg-blue-600 text-white shadow-sm":"text-slate-400 hover:bg-white/10 hover:text-white")} onClick={()=>setQueue(value)}>
                  <Icon className="size-4"/>
                </button>)}
            </div>
            <span className="h-5 w-px bg-white/15" aria-hidden="true"/>
            <div role="group" aria-label="Filtrar conversas por status" className="grid min-w-0 grid-cols-4 items-center justify-items-center gap-0.5">
              {([["","Todos os estados",ListFilter],["open","Abertas",CircleDot],
                 ["pending","Pendentes",Clock3],["resolved","Resolvidas",CheckCheck]] as const).map(([value,label,Icon])=>
                <button type="button" key={value} title={label} aria-label={label} aria-pressed={filter===value}
                  className={"flex h-6 w-full max-w-6 min-w-0 items-center justify-center rounded-md transition-colors "+
                   (filter===value?"bg-blue-600 text-white shadow-sm":"text-slate-400 hover:bg-white/10 hover:text-white")} onClick={()=>setFilter(value)}>
                  <Icon className="size-4"/>
                </button>)}
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Lista de conversas" data-scroll-pane="contacts">
          {listError&&<div role="alert" className="border-b border-amber-200 bg-amber-50 p-3 text-xs">Falha ao atualizar a fila. <button className="underline" onClick={()=>void refresh(true)}>Tentar novamente</button></div>}
          {loading&&records.length===0&&<p className="flex items-center gap-2 p-4 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> Carregando...</p>}
          {!loading&&!listError&&matching.length===0&&<p className="p-7 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>}
          {matching.map(record=><button type="button" key={record.id} onClick={()=>choose(record)}
            aria-current={selected?.id===record.id?"true":undefined}
            className={"flex w-full items-start gap-3 border-b border-border px-3 py-3.5 text-left hover:bg-muted/40 "+(selected?.id===record.id?"bg-[#eef3ff]":"")}>
            {record.channel==="whatsapp"?<WhatsAppAvatar api={api} id={record.id} isGroup={Boolean(record.isGroup)}/>:
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"><MessageCircle className="size-5"/></span>}
            <span className="min-w-0 flex-1">
              <strong className="block truncate text-sm" title={inboxCallerLabel(record)}>{inboxCallerLabel(record)}</strong>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{record.assignedTo?(record.assignedTo===actorId?"Com você":"Outro atendente"):"Sem atendente"} · {record.handoff==="bot"?"Bot":"Humano"}</span>
              <span className="mt-1 block text-[11px] text-muted-foreground">{timeLabel(record.updatedAt)} · {record.channel==="whatsapp"?"WhatsApp":"Simulação"}</span>
              {Number(record.unreadCount??0)>0&&<Badge className="mt-1 border-0 bg-emerald-500 text-white">{record.unreadCount} não lidas</Badge>}
              {record.isFavorite&&<Star className="mt-1 size-3.5 fill-amber-400 text-amber-500" aria-label="Favorita"/>}
              {record.channel==="whatsapp"&&!record.isGroup&&!record.crmPersonId&&<span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-indigo-600"><UserRoundPlus className="size-3"/> Contato não cadastrado</span>}
            </span>
            <Badge variant={statusVariant[record.status]} className="shrink-0 text-[10px]">{statusLabel[record.status]}</Badge>
          </button>)}
          {moreAvailable&&<button type="button" className="w-full border-t px-3 py-3 text-center text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
            onClick={()=>void loadMore()} disabled={loadingMore}>
            {loadingMore?"Carregando...":"Carregar mais conversas"}
          </button>}
        </div>
        <p className="shrink-0 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">WhatsApp e simulação · {records.length} conversas carregadas</p>
      </div>
  );

  return <section className="flex h-full max-h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white" aria-label="Inbox">
    {toolbarTarget && createPortal(
    <div className="flex min-w-0 items-center gap-2" role="toolbar" aria-label="Ações da Inbox">

      <Button type="button" size="icon-sm" variant="outline" title="Atualizar fila" aria-label="Atualizar fila" onClick={()=>void refresh(true)}>
        <RefreshCw className={loading?"size-4 animate-spin":"size-4"}/>
      </Button>
      <Button type="button" size="icon-sm" title="Nova conversa" aria-label="Nova conversa" onClick={newConversation}><Plus className="size-4"/></Button>
      <details className="relative group">
        <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-input bg-white text-slate-600 hover:bg-muted" aria-label="Mais ações de atendimento" title="Mais ações de atendimento"><MoreHorizontal className="size-5"/></summary>
        <div className="absolute left-0 top-full z-30 mt-1 flex min-w-[220px] flex-col gap-2 rounded-xl border bg-white p-3 shadow-xl">
          <span className="flex items-center gap-2 text-xs font-semibold text-slate-600"><SlidersHorizontal className="size-4"/> Atendimento</span>
          <div className="flex items-center gap-2">
      <Button type="button" size="icon-sm" variant="outline" title={mine?"Liberar atendimento":"Assumir atendimento"}
        aria-label={mine?"Liberar atendimento":"Assumir atendimento"} disabled={!selected||sending||!actorId}
        onClick={()=>{if(selected)void mutate(()=>api.setAssignment(selected.id,mine?null:actorId),mine?"Conversa liberada.":"Atendimento assumido.")}}>
        {mine?<UserMinus className="size-4"/>:<UserRoundCheck className="size-4"/>}
      </Button>
      <Button type="button" size="icon-sm" variant="outline" title={selected?.handoff==="bot"?"Transferir ao humano":"Transferir ao bot"}
        aria-label={selected?.handoff==="bot"?"Transferir ao humano":"Transferir ao bot"} disabled={!selected||sending}
        onClick={()=>{if(selected)void mutate(()=>api.setHandoff(selected.id,selected.handoff==="human"?"bot":"human"),"Modo de atendimento atualizado.")}}>
        {selected?.handoff==="bot"?<UsersRound className="size-4"/>:<Bot className="size-4"/>}
      </Button>
      <label className="flex items-center gap-1.5 rounded-lg border border-input bg-white px-2 py-1.5 text-xs">
        <span className="sr-only">Estado do atendimento</span>
        <CircleCheck className="size-4 text-slate-500"/>
        <select aria-label="Estado do atendimento" className="min-w-0 max-w-27 bg-transparent text-xs outline-none" value={selected?.status??""}
          disabled={!selected||sending} onChange={e=>{if(selected)void mutate(()=>api.setStatus(selected.id,e.target.value as Status),"Status atualizado.")}}>
          <option value="">Estado</option><option value="open">Aberta</option><option value="pending">Pendente</option><option value="resolved">Resolvida</option>
        </select>
      </label>
          </div></div></details>
      <span className="hidden text-[11px] text-slate-500 xl:inline" role="status">{live?"● Tempo real":"Atualização periódica"}</span>
    </div>
    , toolbarTarget)}
    <div className="grid min-h-0 min-w-0 flex-1 overflow-hidden grid-cols-1">
      <div className={(showThread ? "hidden " : "block ") + "min-h-0 md:hidden"}>{renderQueue(false)}</div>
      {sidebarTarget && createPortal(renderQueue(true), sidebarTarget)}
      <div className={(showThread?"flex ":"hidden ")+"min-h-0 min-w-0 overflow-hidden flex-col bg-[#f7f9fd] md:flex"}>
        {!selected&&<div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <MessageCircle className="size-9 text-indigo-300"/><p className="text-sm font-medium">Selecione uma conversa para atender.</p>
        </div>}
        {selected&&<>
          <div className="flex min-h-16 shrink-0 items-center gap-2 border-b border-border bg-white px-3 py-2 lg:px-5">
            <Button type="button" size="icon-sm" variant="ghost" className="md:hidden" title="Voltar à lista" aria-label="Voltar às conversas" onClick={closeMobileThread}><ArrowLeft className="size-4"/></Button>
            {selected.channel==="whatsapp"&&<WhatsAppAvatar api={api} id={selected.id} isGroup={Boolean(selected.isGroup)} size="md"/>}
            {selected.isGroup&&<Badge variant="secondary">Grupo</Badge>}
            {selected.channel==="whatsapp"&&<Badge className="border-0 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">WhatsApp</Badge>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900" title={inboxCallerLabel(selected)}>{inboxCallerLabel(selected)}</p>
              <p className="truncate text-[11px] text-muted-foreground">{selected.displayName&&selected.phoneNumber?selected.phoneNumber+" · ":""}{selected.contactNameSyncStatus==="submitted"?"Nome enviado ao WhatsApp · confira no celular":selected.crmPersonId?"Contato vinculado ao CRM":"Sem contato vinculado"}</p>
            </div>
            {selected.channel==="whatsapp"&&selected.isGroup&&<Button type="button" size="icon-sm" variant="ghost"
              title="Informações canônicas e edição do grupo WhatsApp" aria-label="Informações do grupo WhatsApp"
              onClick={()=>void openGroupInfo(selected)}><Users className="size-4"/></Button>}
            {selected.channel==="whatsapp"&&!selected.isGroup&&!selected.crmPersonId&&<Button type="button" size="sm" variant="outline"
              className="gap-1.5 text-indigo-700" onClick={()=>openContactDialog(selected)}>
              <UserRoundPlus className="size-4"/> <span className="hidden sm:inline">Cadastrar contato</span><span className="sm:hidden">Cadastrar</span>
            </Button>}
            {selected.channel==="whatsapp"&&!selected.isGroup&&selected.phoneNumber&&<Button type="button"
              size="icon-sm" variant="ghost" title="Editar nome no WhatsApp"
              aria-label="Editar nome no WhatsApp" onClick={()=>void openNameEditor(selected)}>
              <Pencil className="size-4"/>
            </Button>}
            {selected.channel==="whatsapp"&&<Button type="button" size="icon-sm" variant="ghost"
              title={selected.isFavorite?"Remover dos favoritos":"Adicionar aos favoritos"}
              aria-label={selected.isFavorite?"Remover dos favoritos":"Adicionar aos favoritos"}
              onClick={()=>void mutate(()=>api.setConversationFavorite(selected.id,!selected.isFavorite),"Favoritos atualizados.")}>
              <Star className={"size-4 "+(selected.isFavorite?"fill-amber-400 text-amber-500":"text-slate-500")}/>
            </Button>}
            {selected.channel==="whatsapp"&&<Button type="button" size="icon-sm" variant="ghost"
              title="Carregar até 50 mensagens anteriores" aria-label="Sincronizar histórico anterior"
              onClick={()=>void syncOlderHistory()} disabled={syncingHistory}>
              {syncingHistory?<LoaderCircle className="size-4 animate-spin"/>:<History className="size-4"/>}
            </Button>}
            <Button type="button" size="icon-sm" variant="outline" aria-label="Abrir inspetor de contato" title="Abrir inspetor CRM"
              onClick={()=>setContextOpen(true)}><PanelRightOpen className="size-4"/></Button>
          </div>
          <div ref={messagesViewport} onScroll={onMessagesScroll} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 lg:p-6" data-scroll-pane="messages" aria-label="Histórico de mensagens" aria-live="polite">
            {reading&&<p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> Carregando histórico...</p>}
            {threadError&&<p role="alert" className="text-sm text-amber-900">Falha ao ler o histórico. <button className="underline" onClick={()=>void readThread(selected.id,true)}>Tentar novamente</button></p>}
            {!reading&&!threadError&&!thread.length&&<p className="my-auto text-center text-sm text-muted-foreground">Esta conversa ainda não tem mensagens.</p>}
            {thread.map(message=><div key={message.id}
              className={"max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-xs sm:max-w-[68%] "+(
                message.direction==="outbound"?"ml-auto bg-[#3b61db] text-white":
                message.direction==="internal"?"border border-amber-200 bg-amber-50 text-amber-950":"border border-border bg-white")}>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide opacity-75">
                {message.direction==="internal"?"Nota interna":message.direction==="outbound"?"Equipe":"Cliente"}
                <time className="ml-auto font-normal normal-case">{timeLabel(message.createdAt)}</time>
              </div>
              <p className="whitespace-pre-wrap break-words">{message.body}</p>
              {selected.channel==="whatsapp"&&message.direction==="outbound"&&
                <div className="mt-1 flex justify-end"><WhatsAppDeliveryIndicator status={message.deliveryStatus}/></div>}
            </div>)}
          </div>
          <div className="shrink-0 space-y-2 border-t border-border bg-white px-3 py-3 lg:px-5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de mensagem">
              {composerModes.map(mode=><button type="button" key={mode.value} aria-pressed={composerMode===mode.value}
                className={"flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium "+(composerMode===mode.value?"bg-[#e8efff] text-[#345bd2]":"bg-muted/50 text-muted-foreground")}
                onClick={()=>setComposerMode(mode.value)}><mode.icon className="size-3.5"/>{mode.label}</button>)}
            </div>
            {composerMode!=="simulator/inbound"&&replyReason&&<p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{replyReason}</p>}
            {composerMode==="simulator/inbound"&&<p className="text-[11px] text-muted-foreground">Teste interno: não envia mensagens externas.</p>}
            <form onSubmit={e=>{e.preventDefault();void send()}} className="space-y-1.5">
              <label htmlFor="inbox-composer" className="sr-only">Mensagem</label>
              <div className="flex items-end gap-2">
                <Textarea id="inbox-composer" rows={2} maxLength={5000} value={composer}
                  disabled={sending||replyDisabled} className="min-h-16 flex-1 resize-none"
                  placeholder={composerMode==="notes"?"Nota visível apenas à equipe...":composerMode==="simulator/inbound"?"Simular mensagem recebida...":"Digite sua resposta..."}
                  onChange={e=>updateComposer(e.target.value)}
                  onKeyDown={e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter"&&!e.nativeEvent.isComposing){e.preventDefault();if(!sending&&!replyDisabled&&composer.trim())void send()}}}/>
                <Button type="submit" size="icon-lg" className="mb-1 shrink-0" title={composerMode==="notes"?"Registrar nota":"Enviar mensagem"}
                  aria-label={composerMode==="notes"?"Registrar nota":composerMode==="simulator/inbound"?"Simular entrada":"Enviar resposta"}
                  disabled={sending||replyDisabled||!composer.trim()}>
                  {sending?<LoaderCircle className="size-4 animate-spin"/>:<Send className="size-4"/>}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{composer.length}/5000 · Ctrl/⌘ + Enter envia</p>
            </form>
          </div>
        </>}
      </div>
    </div>

    <Sheet open={contextOpen && Boolean(selected)} onOpenChange={setContextOpen}>
      <SheetContent side="right" className="gap-0 p-0">
        <SheetHeader className="sr-only"><SheetTitle>Contexto do contato CRM</SheetTitle>
          <SheetDescription>Dados e histórico de contato autorizados pelo Core Host</SheetDescription></SheetHeader>
        {selected && <InboxInspectorPanel key={selected.id} api={api} conversation={selected}
          onOpenCrm={() => { setContextOpen(false); onOpenCrm(); }}/>}
      </SheetContent>
    </Sheet>
    <Dialog open={nameEditorOpen} onOpenChange={setNameEditorOpen}><DialogContent>
      <DialogHeader><DialogTitle>Editar nome no WhatsApp</DialogTitle>
        <DialogDescription>A alteração será enviada ao WhatsApp da conta conectada. Ela não modifica o nome público escolhido pela outra pessoa.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();void saveWhatsAppName()}}>
        <div className="space-y-1.5">
          <label htmlFor="whatsapp-name-to-save" className="text-sm font-semibold">Nome a salvar</label>
          <Input id="whatsapp-name-to-save" value={nameEditorValue} maxLength={160} required
            onChange={e=>setNameEditorValue(e.target.value)} placeholder="Nome do contato"/>
          <p className="text-xs text-muted-foreground">Telefone verificado: {selected?.phoneNumber??"—"}</p>
        </div>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={nameEditorPhone}
            onChange={e=>setNameEditorPhone(e.target.checked)}/>
          <span>Solicitar também o salvamento na agenda do celular
            <span className="block text-xs text-muted-foreground">Opcional; depende de suporte e sincronização do dispositivo principal.</span>
          </span>
        </label>
        <p className="text-xs text-amber-800">A aceitação pelo WhatsApp não garante que o nome já apareceu no celular. Se o contato estiver vinculado ao CRM, o nome informado deve corresponder ao cadastro.</p>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={()=>setNameEditorOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={nameEditorBusy||!nameEditorValue.trim()}>
            {nameEditorBusy?"Enviando...":"Salvar no WhatsApp"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent></Dialog>
    <Dialog open={contactOpen} onOpenChange={setContactOpen}><DialogContent>
      <DialogHeader><DialogTitle>Cadastrar contato WhatsApp</DialogTitle>
        <DialogDescription>Cadastre uma pessoa ou vincule um contato existente a esta conversa. O vínculo respeita as permissões do CRM e do tenant.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e=>{e.preventDefault();void saveContact()}}>
        {contactMatches.length>0&&<div className="space-y-1.5"><label htmlFor="contact-existing" className="text-sm font-semibold">Contato existente (opcional)</label>
          <select id="contact-existing" className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm"
            value={contactExistingId} onChange={e=>setContactExistingId(e.target.value)}>
            <option value="">Criar novo contato</option>
            {contactMatches.map(p=><option key={p.id} value={p.id}>{p.name}{p.phone?" · "+p.phone:""}</option>)}
          </select>
        </div>}
        {!contactExistingId&&<><div className="space-y-1.5"><label htmlFor="contact-name" className="text-sm font-semibold">Nome</label>
          <Input id="contact-name" autoComplete="name" value={contactName} maxLength={160} required={!contactCreatedId}
            placeholder="Nome do contato" onChange={e=>setContactName(e.target.value)} disabled={Boolean(contactCreatedId)}/>
        </div>
        <div className="space-y-1.5"><label htmlFor="contact-phone" className="text-sm font-semibold">Telefone</label>
          <Input id="contact-phone" type="tel" autoComplete="tel" value={contactPhone} maxLength={32}
            placeholder="+55..." onChange={e=>setContactPhone(e.target.value)} disabled={Boolean(contactCreatedId)}/>
          <p className="text-[11px] text-muted-foreground">{selected?.phoneNumber?"Número verificado pelo gateway WhatsApp.":"Número não fornecido pelo WhatsApp; confira antes de preencher."}</p>
        </div></>}
        {contactCreatedId&&<p className="text-xs text-amber-800">Contato já criado; o próximo passo tentará apenas vinculá-lo.</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={()=>setContactOpen(false)}>Cancelar</Button>
          <Button type="submit" disabled={contactBusy||(!contactExistingId&&!contactCreatedId&&!contactName.trim())}>
            {contactBusy?"Salvando...":contactExistingId||contactCreatedId?"Vincular contato":"Cadastrar e vincular"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent></Dialog>
    <Dialog open={groupOpen} onOpenChange={setGroupOpen}><DialogContent>
      <DialogHeader><DialogTitle>Informações do grupo WhatsApp</DialogTitle>
        <DialogDescription>O WhatsApp é a fonte canônica. Alterações exigem permissão no próprio grupo e confirmação do servidor.</DialogDescription>
      </DialogHeader>
      {groupBusy&&!groupInfo&&<p className="text-sm">Consultando informações diretamente no WhatsApp...</p>}
      {groupError&&<p role="alert" className="text-sm text-red-700">{groupError}</p>}
      {groupInfo&&<div className="space-y-4">
        <p className="text-xs text-muted-foreground">{groupInfo.participantCount} participantes · {groupInfo.announce?"Somente administradores enviam mensagens":"Participantes podem enviar mensagens"} · {groupInfo.locked?"Edição restrita no WhatsApp":"Edição permitida conforme suas permissões"}</p>
        <div className="space-y-1.5"><label htmlFor="whatsapp-group-name" className="text-sm font-semibold">Nome do grupo</label>
          <div className="flex gap-2"><Input id="whatsapp-group-name" maxLength={100} value={groupName} onChange={event=>setGroupName(event.target.value)} disabled={!groupInfo.canEdit||groupBusy}/>
            <Button type="button" disabled={!groupInfo.canEdit||groupBusy||!groupName.trim()||groupName===groupInfo.name}
             onClick={()=>void saveGroupField("name")}>Salvar</Button></div>
        </div>
        <div className="space-y-1.5"><label htmlFor="whatsapp-group-description" className="text-sm font-semibold">Descrição</label>
          <Textarea id="whatsapp-group-description" maxLength={2048} value={groupDescription}
           onChange={event=>setGroupDescription(event.target.value)} disabled={!groupInfo.canEdit||groupBusy}/>
          <Button type="button" variant="outline" disabled={!groupInfo.canEdit||groupBusy||groupDescription===groupInfo.description}
           onClick={()=>void saveGroupField("description")}>Atualizar descrição no WhatsApp</Button>
        </div>
        {!groupInfo.canEdit&&<p className="text-xs text-amber-700">Sua conta vinculada não tem permissão para editar este grupo no WhatsApp.</p>}
      </div>}
      <DialogFooter><Button type="button" variant="outline" onClick={()=>setGroupOpen(false)}>Fechar</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent>
      <DialogHeader><DialogTitle>Nova conversa</DialogTitle>
        <DialogDescription>Crie uma conversa de demonstração no tenant atual. Nenhuma mensagem será enviada ao WhatsApp.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={event => { event.preventDefault(); void create(); }}>
        <div className="space-y-1.5"><label htmlFor="inbox-subject" className="text-sm font-semibold">Assunto</label>
          <Input id="inbox-subject" required maxLength={160} value={subject} onChange={event => setSubject(event.target.value)} placeholder="Ex.: Atendimento de novo cliente" /></div>
        <div className="space-y-1.5"><label htmlFor="inbox-person" className="text-sm font-semibold">Contato CRM (opcional)</label>
          <select id="inbox-person" className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm" value={linkedPersonId}
            onChange={event => setLinkedPersonId(event.target.value)}>
            <option value="">Sem vínculo com contato</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
          </select></div>
        <DialogFooter><Button variant="outline" type="button" onClick={() => setDialog(false)}>Cancelar</Button>
          <Button type="submit" disabled={sending || !subject.trim()}>{sending ? "Criando..." : "Criar conversa"}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </section>;
}
