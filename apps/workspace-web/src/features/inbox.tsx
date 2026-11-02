import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Bot, CircleCheck, Clock3, Inbox, LoaderCircle,
  MessageCircle, Plus, RefreshCw, Search, Send, UserMinus, UserRoundCheck,
  UsersRound, StickyNote, FlaskConical, ContactRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CustomerContextPanel } from "@/features/inbox-context";
import { isMine, replyBlockReason } from "@/features/inbox-rules";
import { clearSentDraft, draftKey, setDraft, type ComposerMode } from "@/features/inbox-drafts";
import type { Conversation, Message, Person, TenantApi, QueueFilter } from "@/lib/api";

type Status = Conversation["status"];
const FALLBACK_INTERVAL_MS = 10_000;
const statusLabel: Record<Status, string> = { open: "Aberta", pending: "Pendente", resolved: "Resolvida" };
const statusVariant: Record<Status, "secondary" | "outline" | "default"> = {
  open: "secondary", pending: "outline", resolved: "default",
};
const filters: { value: "" | Status; label: string }[] = [
  { value: "", label: "Todas" }, { value: "open", label: "Abertas" },
  { value: "pending", label: "Pendentes" }, { value: "resolved", label: "Resolvidas" },
];
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

export function InboxFeature({ api, actorId, onOpenCrm }: { api: TenantApi; actorId: string; onOpenCrm: () => void }) {
  const [records, setRecords] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [filter, setFilter] = useState<"" | Status>("");
  const [queue, setQueue] = useState<QueueFilter>("all");
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
  const activeId = useRef<string | null>(null);
  const listRequest = useRef(0);
  const threadRequest = useRef(0);
  const busy = useRef(false);

  const refresh = useCallback(async (showLoading = false) => {
    const requestId = ++listRequest.current;
    if (showLoading) setLoading(true);
    try {
      const result = await api.conversations(filter, queue);
      if (requestId !== listRequest.current) return;
      setRecords(result);
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
  }, [api, filter, queue]);

  const readThread = useCallback(async (id: string, showLoading = false) => {
    const requestId = ++threadRequest.current;
    if (showLoading) setReading(true);
    try {
      const [conversation, messages] = await Promise.all([api.conversation(id), api.messages(id)]);
      if (requestId !== threadRequest.current || activeId.current !== id) return;
      setSelected(conversation);
      setThread(messages);
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
    const visible = () => {if(document.visibilityState==="visible")reload();};
    document.addEventListener("visibilitychange",visible);
    return ()=>{
      abort.abort();
      if(retry)clearTimeout(retry);
      window.clearInterval(timer);
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
    setSelected(conversation);
    setThread([]);
    setThreadError(false);
    setComposerMode("replies");
    setContextOpen(false);
    void readThread(conversation.id, true);
  };
  const closeMobileThread = () => {
    activeId.current = null;
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
      toast.success(mode === "notes" ? "Nota interna registrada." : mode === "simulator/inbound" ? "Mensagem simulada recebida." : "Resposta registrada.");
    } catch (error) {
      // Preserve draft on network errors, forbidden access or validation failures.
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
    } finally {
      busy.current = false;
      setSending(false);
    }
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
  const matching = records.filter(item => item.subject.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  const replyReason = replyBlockReason(selected, actorId);
  const replyDisabled = composerMode !== "simulator/inbound" && Boolean(replyReason);
  const mine = isMine(selected, actorId);
  const showThread = Boolean(selected);
  const newConversation = () => {
    setSubject("");
    setLinkedPersonId("");
    setPeople([]);
    setDialog(true);
    void api.people().then(setPeople).catch(() => {
      toast.info("Contatos do CRM indisponíveis. Você pode criar uma conversa sem vínculo.");
    });
  };

  return <section className="flex min-h-0 flex-col gap-4 md:h-[calc(100dvh-205px)] md:min-h-[620px]">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">Central de atendimento</p><h1 className="page-title">Inbox</h1>
        <p className="page-subtitle">Acompanhe, atribua e responda conversas em um único espaço.</p></div>
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-muted-foreground sm:inline" role="status">{live?"Atualização em tempo real":"Reconectando · consulta a cada 10 s"}</span>
        <Button variant="outline" size="icon-lg" aria-label="Atualizar fila" title="Atualizar fila" onClick={() => void refresh(true)}><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /></Button>
        <Button size="lg" onClick={newConversation}><Plus className="size-4" /> Nova conversa</Button>
      </div>
    </div>
    <Card className="min-h-0 flex-1 overflow-hidden border-[#e6eaf1] py-0 shadow-[0_5px_28px_-12px_#29334f25]">
      <CardContent className="grid h-full min-h-[560px] grid-cols-1 p-0 md:min-h-0 md:grid-cols-[310px_minmax(0,1fr)] xl:grid-cols-[285px_minmax(0,1fr)_260px]">
        <div className={(showThread ? "hidden " : "flex ") + "min-h-0 flex-col border-border md:flex md:border-r"}>
          <div className="space-y-3 border-b border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Fila de conversas</h2>
              <Badge variant="secondary">{records.length} conversas</Badge>
            </div>
            <div className="relative"><Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input aria-label="Pesquisar conversas" className="pl-9" placeholder="Pesquisar por assunto..." value={search} onChange={event => setSearch(event.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Filtrar conversas por responsável">
              {([
                ["mine", "Minhas"], ["unassigned", "Não atribuídas"], ["all", "Todas"],
              ] as [QueueFilter, string][]).map(([value, label]) => <button type="button" key={value} aria-pressed={queue === value}
                className={"min-w-0 rounded-lg px-1.5 py-2 text-[11px] font-semibold transition-colors " + (queue === value ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-indigo-700")}
                onClick={() => setQueue(value)}>{label}</button>)}
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar conversas por status">
              {filters.map(item => <button type="button" key={item.value} aria-pressed={filter === item.value}
                className={"rounded-full px-3 py-1.5 text-xs font-medium transition " + (filter === item.value ? "bg-[#e8efff] text-[#345bd2]" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
                onClick={() => setFilter(item.value)}>{item.label}</button>)}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto" aria-label="Lista de conversas">
            {listError && <div role="alert" className="border-b border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Não foi possível atualizar a fila. <button className="font-semibold underline" onClick={() => void refresh(true)}>Tentar novamente</button></div>}
            {loading && records.length === 0 && <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Carregando conversas...</p>}
            {!loading && !listError && matching.length === 0 && <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Inbox className="size-8 text-muted-foreground/40" /><p className="text-sm font-semibold">Nenhuma conversa encontrada</p>
              <p className="text-xs text-muted-foreground">Ajuste o filtro ou abra um novo atendimento.</p>
            </div>}
            {matching.map(record => <button type="button" key={record.id} aria-current={selected?.id === record.id ? "true" : undefined}
              onClick={() => choose(record)}
              className={"flex w-full items-start gap-3 border-b border-border px-4 py-4 text-left transition-colors " + (selected?.id === record.id ? "bg-[#eef3ff]" : "hover:bg-muted/40")}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e5ecff] text-[#476bd0]"><MessageCircle className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">{record.subject}</strong>
                <span className="mt-1 block truncate text-xs text-muted-foreground">{record.assignedTo ? (record.assignedTo === actorId ? "Com você" : "Com outro atendente") : "Sem atendente"} · {record.handoff === "bot" ? "Bot" : "Humano"}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">{timeLabel(record.updatedAt)}</span>
              </span>
              <Badge variant={statusVariant[record.status]} className="text-[10px]">{statusLabel[record.status]}</Badge>
            </button>)}
          </div>
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">Canal: simulação · Até 100 desta fila por consulta</p>
        </div>

        <div className={(showThread ? "flex " : "hidden ") + "min-h-0 min-w-0 flex-col bg-[#fcfdff] md:flex"}>
          {!selected && <div className="flex h-full min-h-[480px] flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="rounded-2xl bg-[#eaf0ff] p-5 text-[#4264c8]"><MessageCircle className="size-8" /></span>
            <h3 className="font-semibold">Selecione um atendimento</h3>
            <p className="max-w-sm text-sm text-muted-foreground">Abra uma conversa na fila para ver o histórico, assumir o atendimento ou responder.</p>
          </div>}
          {selected && <>
            <div className="space-y-3 border-b border-border bg-card px-4 py-4 lg:px-5">
              <div className="flex flex-wrap items-start gap-2">
                <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Voltar para conversas" onClick={closeMobileThread}><ArrowLeft className="size-4" /></Button>
                <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{selected.subject}</h2>
                  <p className="text-xs text-muted-foreground">{selected.crmPersonId ? "Vinculada a contato CRM" : "Sem contato CRM"} · {selected.channel}</p></div>
                <Button size="sm" variant="outline" className="gap-1.5 xl:hidden" onClick={() => setContextOpen(true)} aria-label="Ver contexto CRM">
                  <ContactRound className="size-4"/> Contato CRM
                </Button>
                <Badge variant={statusVariant[selected.status]}>{statusLabel[selected.status]}</Badge>
                <Badge variant="outline" className="gap-1">{selected.handoff === "bot" ? <Bot className="size-3.5" /> : <UsersRound className="size-3.5" />}{selected.handoff === "bot" ? "Bot" : "Humano"}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(["open", "pending", "resolved"] as const).map(status =>
                  <Button key={status} variant={selected.status === status ? "secondary" : "outline"} size="sm"
                    disabled={sending || selected.status === status}
                    onClick={() => void mutate(() => api.setStatus(selected.id, status), "Status atualizado.")}>
                    {status === "open" ? <MessageCircle className="size-3.5" /> : status === "pending" ? <Clock3 className="size-3.5" /> : <CircleCheck className="size-3.5" />}
                    {statusLabel[status]}
                  </Button>)}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {actorId && <Button size="sm" variant="outline" disabled={sending}
                  onClick={() => void mutate(() => api.setAssignment(selected.id, mine ? null : actorId), mine ? "Conversa liberada." : "Atendimento assumido.")}>
                  {mine ? <UserMinus className="size-3.5" /> : <UserRoundCheck className="size-3.5" />}
                  {mine ? "Liberar" : "Assumir"}
                </Button>}
                <Button size="sm" variant="outline" disabled={sending}
                  onClick={() => void mutate(() => api.setHandoff(selected.id, selected.handoff === "human" ? "bot" : "human"), "Modo de atendimento atualizado.")}>
                  {selected.handoff === "human" ? <Bot className="size-3.5" /> : <UsersRound className="size-3.5" />}
                  {selected.handoff === "human" ? "Transferir ao bot" : "Transferir ao humano"}
                </Button>
                <span className="ml-auto text-xs text-muted-foreground">{mine ? "Atribuída a você" : selected.assignedTo ? "Atribuída a outro atendente" : "Não atribuída"}</span>
              </div>
            </div>
            <div className="flex min-h-[240px] flex-1 flex-col gap-3 overflow-y-auto bg-[#f7f9fd] p-4 lg:p-5" aria-label="Histórico de mensagens" aria-live="polite">
              {reading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Carregando histórico...</p>}
              {threadError && <p role="alert" className="text-sm text-amber-900">Falha ao ler o histórico. <button className="underline" onClick={() => void readThread(selected.id, true)}>Tentar novamente</button></p>}
              {!reading && !threadError && thread.length === 0 && <p className="my-auto text-center text-sm text-muted-foreground">Esta conversa ainda não tem mensagens.</p>}
              {thread.map(message => <div key={message.id} className={"max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-xs sm:max-w-[75%] " + (
                message.direction === "outbound" ? "ml-auto bg-[#3b61db] text-white" :
                  message.direction === "internal" ? "border border-amber-200 bg-amber-50 text-amber-950" : "border border-border bg-white"
              )}>
                <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide opacity-75">
                  {message.direction === "internal" ? "Nota interna" : message.direction === "outbound" ? "Equipe" : "Cliente"}
                  <time className="ml-auto font-normal normal-case">{timeLabel(message.createdAt)}</time>
                </div>
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              </div>)}
            </div>
            <div className="space-y-3 border-t border-border bg-card p-4">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de mensagem">
                {composerModes.map(mode => <button type="button" key={mode.value} aria-pressed={composerMode === mode.value}
                  className={"flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors " + (composerMode === mode.value ? "bg-[#e8efff] text-[#345bd2]" : "bg-muted/50 text-muted-foreground hover:bg-muted")}
                  onClick={() => setComposerMode(mode.value)}><mode.icon className="size-3.5" />{mode.label}</button>)}
              </div>
              {composerMode !== "simulator/inbound" && replyReason && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{replyReason}</p>}
              {composerMode === "simulator/inbound" && <p className="text-xs text-muted-foreground">Teste interno: não envia mensagens para um canal externo.</p>}
              <form onSubmit={event => { event.preventDefault(); void send(); }} className="space-y-2">
                <label htmlFor="inbox-composer" className="sr-only">{composerMode === "notes" ? "Nota interna" : "Mensagem"}</label>
                <Textarea id="inbox-composer" rows={2} maxLength={5000} value={composer} disabled={sending || replyDisabled}
                  placeholder={composerMode === "notes" ? "Nota visível apenas à equipe..." : composerMode === "simulator/inbound" ? "Simular mensagem recebida..." : "Digite sua resposta..."}
                  onChange={event => updateComposer(event.target.value)}
                  onKeyDown={event => {
                    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      if (!sending && !replyDisabled && composer.trim()) void send();
                    }
                  }}
                  className="min-h-18 resize-y" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{composer.length}/5000 · Ctrl/⌘ + Enter envia</span>
                  <Button type="submit" disabled={sending || replyDisabled || !composer.trim()}><Send className="size-4" />
                    {sending ? "Processando..." : composerMode === "notes" ? "Registrar nota" : composerMode === "simulator/inbound" ? "Simular entrada" : "Enviar resposta"}
                  </Button>
                </div>
              </form>
            </div>
          </>}
        </div>
        <div className="hidden min-h-0 border-l border-border xl:flex xl:flex-col">
          {selected ? <CustomerContextPanel key={selected.crmPersonId ?? "unlinked"} api={api} personId={selected.crmPersonId} onOpenCrm={onOpenCrm}/> :
            <div className="p-5 text-sm text-muted-foreground">Selecione uma conversa para ver o contexto CRM.</div>}
        </div>
      </CardContent>
    </Card>

    <Sheet open={contextOpen && Boolean(selected)} onOpenChange={setContextOpen}>
      <SheetContent side="right" className="gap-0 p-0">
        <SheetHeader className="sr-only"><SheetTitle>Contexto do contato CRM</SheetTitle>
          <SheetDescription>Dados e histórico de contato autorizados pelo Core Host</SheetDescription></SheetHeader>
        {selected && <CustomerContextPanel key={selected.crmPersonId ?? "unlinked"} api={api} personId={selected.crmPersonId}
          onOpenCrm={() => { setContextOpen(false); onOpenCrm(); }}/>}
      </SheetContent>
    </Sheet>
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
