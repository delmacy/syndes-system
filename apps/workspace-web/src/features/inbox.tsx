import { useCallback, useEffect, useState } from "react";
import { ArrowUpRight, CircleCheck, Inbox, LoaderCircle, MessageCircle, Plus, RefreshCw, Search, Send, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Conversation, Message, Person, TenantApi } from "@/lib/api";

const statusLabel: Record<Conversation["status"], string> = { open: "Aberta", pending: "Pendente", resolved: "Resolvida" };
const statusVariant: Record<Conversation["status"], "secondary" | "outline" | "default"> = { open: "secondary", pending: "outline", resolved: "default" };

export function InboxFeature({ api, actorId }: { api: TenantApi; actorId: string }) {
  const [records, setRecords] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [composer, setComposer] = useState("");
  const [dialog, setDialog] = useState(false);
  const [subject, setSubject] = useState("");
  const [linkedPersonId, setLinkedPersonId] = useState("");
  const [people, setPeople] = useState<Person[]>([]);

  const refresh = useCallback(async (status: string) => {
    setLoading(true);
    try { setRecords(await api.conversations(status)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao carregar conversas."); }
    finally { setLoading(false); }
  }, [api]);
  useEffect(() => { void refresh(filter); }, [refresh, filter]);
  const open = async (record: Conversation) => {
    setSelected(record);
    try { setThread(await api.messages(record.id)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível ler mensagens."); }
  };
  const update = async (task: () => Promise<unknown>) => {
    try {
      await task();
      await refresh(filter);
      if (selected) setThread(await api.messages(selected.id));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar a conversa."); }
  };
  const send = async (type: "replies" | "notes" | "simulator/inbound") => {
    if (!selected || !composer.trim()) return;
    setSending(true);
    try {
      await api.message(selected.id, type, { body: composer.trim(), ...(type === "simulator/inbound" ? { externalMessageId: crypto.randomUUID() } : {}) });
      setComposer("");
      await open(selected);
      await refresh(filter);
      toast.success(type === "notes" ? "Nota interna registrada." : "Mensagem registrada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Falha ao enviar."); }
    finally { setSending(false); }
  };
  const create = async () => {
    if (!subject.trim()) return;
    setSending(true);
    try {
      const record = await api.createConversation({ subject: subject.trim(), crmPersonId: linkedPersonId || null });
      setDialog(false); setSubject(""); setLinkedPersonId("");
      await refresh(filter);
      await open(record);
      toast.success("Conversa aberta.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a conversa."); }
    finally { setSending(false); }
  };
  const matching = records.filter(r => r.subject.toLowerCase().includes(search.toLowerCase()));

  return <section className="flex h-[calc(100vh-245px)] min-h-[580px] flex-col gap-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">Atendimento</p><h1 className="page-title">Inbox</h1><p className="page-subtitle">Todas as conversas da sua empresa em um lugar.</p></div>
      <Button size="lg" className="gap-2" onClick={() => { setDialog(true); void api.people().then(setPeople).catch(() => setPeople([])); }}><Plus className="size-4" /> Nova conversa</Button>
    </div>
    <Card className="min-h-0 flex-1 overflow-hidden border-[#e6eaf1] py-0 shadow-[0_5px_28px_-12px_#29334f25]">
      <CardContent className="grid h-full min-h-0 grid-cols-1 gap-0 p-0 md:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col border-b border-border md:border-r md:border-b-0">
          <div className="space-y-3 border-b border-border p-4">
            <div className="flex items-center justify-between"><h2 className="text-sm font-semibold">Conversas</h2><Button variant="ghost" size="icon-sm" aria-label="Recarregar conversas" onClick={() => void refresh(filter)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button></div>
            <div className="relative"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" /><Input className="pl-9" placeholder="Pesquisar conversas..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div className="flex flex-wrap gap-1.5">{[["", "Todas"],["open","Abertas"],["pending","Pendentes"],["resolved","Resolvidas"]].map(([status,label]) => <button key={status} className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${filter === status ? "bg-[#e8efff] text-[#345bd2]" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`} onClick={() => setFilter(status)}>{label}</button>)}</div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Atualizando...</div>}
            {!loading && matching.length === 0 && <div className="flex flex-col items-center gap-2 p-10 text-center"><Inbox className="size-8 text-muted-foreground/40" /><p className="text-sm font-medium">Nenhuma conversa encontrada</p><p className="text-xs text-muted-foreground">Crie uma conversa para iniciar.</p></div>}
            {matching.map(record => <button key={record.id} onClick={() => void open(record)} className={`flex w-full items-start gap-3 border-b border-border px-4 py-4 text-left transition ${selected?.id === record.id ? "bg-[#eef3ff]" : "hover:bg-muted/40"}`}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e5ecff] text-[#476bd0]"><MessageCircle className="size-5" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{record.subject}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{record.channel} · {record.assignedTo ? "Atribuída" : "Sem atendente"}</span></span>
              <Badge variant={statusVariant[record.status]} className="text-[10px]">{statusLabel[record.status]}</Badge>
            </button>)}
          </div>
          <div className="border-t border-border p-3 text-xs text-muted-foreground">{records.length} conversas nesta visualização</div>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col bg-[#fcfdff]">
          {!selected && <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center"><span className="mb-2 rounded-2xl bg-[#eaf0ff] p-5 text-[#4264c8]"><MessageCircle className="size-8" /></span><h3 className="font-semibold">Seu atendimento começa aqui</h3><p className="max-w-sm text-sm text-muted-foreground">Selecione uma conversa à esquerda ou abra um novo atendimento.</p></div>}
          {selected && <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
              <div className="min-w-0"><h3 className="truncate text-sm font-bold">{selected.subject}</h3><p className="text-xs text-muted-foreground">{selected.crmPersonId ? "Vinculada a contato CRM" : "Conversa independente"} · {selected.channel}</p></div>
              <div className="flex gap-2"><Badge variant={statusVariant[selected.status]}>{statusLabel[selected.status]}</Badge><Button variant="outline" size="sm" onClick={() => void update(async () => { const next = selected.status === "resolved" ? "open" : "resolved"; const result = await api.setStatus(selected.id, next); setSelected(result); })}><CircleCheck className="size-4" /> {selected.status === "resolved" ? "Reabrir" : "Resolver"}</Button>
                {actorId && <Button variant="outline" size="sm" onClick={() => void update(async () => { const result = await api.setAssignment(selected.id, actorId); setSelected(result); })}><UserRoundCheck className="size-4" /> Assumir</Button>}
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#f7f9fd] p-5">
              {thread.length === 0 && <div className="my-auto text-center text-sm text-muted-foreground">Esta conversa ainda não tem mensagens.</div>}
              {thread.map((message, index) => <div key={message.id || index} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm shadow-xs ${message.direction === "outbound" ? "ml-auto bg-[#3b61db] text-white" : message.direction === "internal" ? "border border-amber-200 bg-amber-50 text-amber-900" : "border border-border bg-white"}`}><p className="mb-1 text-[10px] font-semibold tracking-wide opacity-65">{message.direction === "internal" ? "NOTA INTERNA" : message.direction === "outbound" ? "EQUIPE" : "CLIENTE"}</p><p className="whitespace-pre-wrap">{message.body}</p></div>)}
            </div>
            <form className="space-y-2 border-t border-border bg-card p-4" onSubmit={e => { e.preventDefault(); void send("replies"); }}>
              <label htmlFor="message-composer" className="sr-only">Mensagem ou nota</label><Textarea id="message-composer" placeholder="Escreva uma mensagem..." rows={2} className="min-h-18 resize-none" value={composer} onChange={e => setComposer(e.target.value)} />
              <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex gap-1.5"><Button size="sm" type="button" variant="outline" disabled={sending || !composer.trim()} onClick={() => void send("notes")}>Nota interna</Button><Button size="sm" type="button" variant="ghost" disabled={sending || !composer.trim()} onClick={() => void send("simulator/inbound")}><ArrowUpRight className="size-3.5" /> Simular entrada</Button></div><Button size="sm" type="submit" disabled={sending || !composer.trim()}><Send className="size-4" /> Enviar</Button></div>
            </form>
          </>}
        </div>
      </CardContent>
    </Card>
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent>
      <DialogHeader><DialogTitle>Nova conversa</DialogTitle><DialogDescription>Crie um atendimento simulado no tenant atual. Integrações reais de WhatsApp serão instaladas como módulos posteriormente.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void create(); }}>
        <div className="space-y-1.5"><label className="text-sm font-semibold" htmlFor="conversation-subject">Assunto</label><Input id="conversation-subject" required maxLength={160} value={subject} onChange={e => setSubject(e.target.value)} placeholder="Ex.: Solicitação de orçamento" /></div>
        <div className="space-y-1.5"><label className="text-sm font-semibold" htmlFor="conversation-person">Contato CRM (opcional)</label><select id="conversation-person" className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm" value={linkedPersonId} onChange={e => setLinkedPersonId(e.target.value)}><option value="">Sem contato vinculado</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></div>
        <DialogFooter><Button variant="outline" type="button" onClick={() => setDialog(false)}>Cancelar</Button><Button type="submit" disabled={sending}>{sending ? "Abrindo..." : "Abrir conversa"}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  </section>;
}
