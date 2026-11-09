import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarPlus, Clock3, ContactRound, Mail, NotebookText, Phone, RefreshCw, UserRoundX, Building2, Tags, Headset, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Conversation, CrmNote, CrmTimelineEvent, CrmTag, Organization, Person, TenantApi } from "@/lib/api";

type State = {
  person: Person | null;
  notes: CrmNote[] | null;
  timeline: CrmTimelineEvent[] | null;
  organizations: Organization[] | null;
  tags: CrmTag[] | null;
  error: string | null;
  loading: boolean;
};
const empty: State = { person: null, notes: null, timeline: null, organizations: null, tags: null, error: null, loading: false };

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const timelineAction: Record<string, string> = {
  created: "Contato cadastrado", updated: "Cadastro atualizado",
  noted: "Nota registrada", archived: "Contato arquivado",
  linked_organization: "Organização vinculada", tagged: "Tag adicionada",
};

export function CustomerContextPanel({ api, personId, onOpenCrm }: {
  api: TenantApi;
  personId: string | null | undefined;
  onOpenCrm: () => void;
}) {
  const [result, setResult] = useState<State>(empty);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!personId) return;
    let cancelled = false;
    void Promise.allSettled([api.person(personId), api.personNotes(personId), api.personTimeline(personId),
      api.personOrganizations(personId), api.personTags(personId)])
      .then(([person, notes, timeline, organizations, tags]) => {
        if (cancelled) return;
        const value = person.status === "fulfilled" ? person.value : null;
        const error = person.status === "rejected"
          ? "Você não pode consultar este contato ou ele não está disponível."
          : null;
        setResult({
          person: value,
          notes: notes.status === "fulfilled" ? notes.value : null,
          timeline: timeline.status === "fulfilled" ? timeline.value : null,
          organizations: organizations.status === "fulfilled" ? organizations.value : null,
          tags: tags.status === "fulfilled" ? tags.value : null,
          error, loading: false,
        });
      });
    return () => { cancelled = true; };
  }, [api, personId, attempt]);

  const retry = () => { setResult({ ...empty, loading: true }); setAttempt(n => n + 1); };
  const data = result;

  return <aside aria-label="Contexto do cliente" className="flex min-h-0 flex-col bg-white">
    <div className="flex items-center justify-between border-b border-border px-4 py-4">
      <div><p className="text-sm font-bold text-slate-800">Contato CRM</p><p className="text-[11px] text-muted-foreground">Contexto do atendimento</p></div>
      {personId && <Button size="icon-sm" variant="ghost" title="Atualizar contato" aria-label="Atualizar contexto CRM" onClick={retry}><RefreshCw className="size-4" /></Button>}
    </div>
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
      {!personId && <div className="flex flex-col items-center gap-3 py-8 text-center">
        <ContactRound className="size-9 text-muted-foreground/40"/>
        <p className="text-sm font-semibold">Sem contato vinculado</p>
        <p className="text-xs leading-relaxed text-muted-foreground">Esta conversa ainda não possui vínculo com uma pessoa do CRM.</p>
        <Button variant="outline" size="sm" onClick={onOpenCrm}>Abrir CRM <ArrowUpRight className="size-3.5"/></Button>
      </div>}
      {personId && data.loading && <p className="text-sm text-muted-foreground">Consultando CRM...</p>}
      {personId && data.error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <UserRoundX className="mb-2 size-5"/>{data.error}
      </div>}
      {personId && !data.loading && !data.error && !data.person && <p className="text-sm text-muted-foreground">Carregando dados do contato...</p>}
      {personId && data.person && !data.error && <>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-base font-bold text-indigo-700">{data.person.name.trim().charAt(0).toLocaleUpperCase("pt-BR")}</span>
            <div className="min-w-0"><h3 className="truncate text-sm font-bold" title={data.person.name}>{data.person.name}</h3><Badge variant="secondary" className="mt-1">Pessoa</Badge></div>
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex items-center gap-2 break-all"><Mail className="size-4 shrink-0 text-slate-500"/>{data.person.email || "E-mail não informado"}</div>
            <div className="flex items-center gap-2"><Phone className="size-4 shrink-0 text-slate-500"/>{data.person.phone || "Telefone não informado"}</div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={onOpenCrm}>Abrir módulo CRM <ArrowUpRight className="size-3.5"/></Button>
        </div>
        <section className="space-y-2" aria-label="Organizações do contato">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600"><Building2 className="size-4"/> Organizações</h4>
          {data.organizations === null && <p className="text-xs text-muted-foreground">Organizações indisponíveis ou sem permissão.</p>}
          {data.organizations?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma organização vinculada.</p>}
          {data.organizations?.map(org => <div key={org.id} className="rounded-lg border border-border p-2.5 text-xs">
            <p className="font-semibold">{org.tradeName || org.legalName}</p>
            {org.tradeName && <p className="mt-1 text-muted-foreground">{org.legalName}</p>}
          </div>)}
        </section>
        <section className="space-y-2" aria-label="Tags do contato">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600"><Tags className="size-4"/> Tags</h4>
          {data.tags === null && <p className="text-xs text-muted-foreground">Tags indisponíveis ou sem permissão.</p>}
          {data.tags?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag.</p>}
          {data.tags && data.tags.length > 0 && <div className="flex flex-wrap gap-1.5">{data.tags.map(tag => <Badge variant="outline" key={tag.id}>{tag.label}</Badge>)}</div>}
        </section>
        <section className="space-y-2" aria-label="Notas do contato">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600"><NotebookText className="size-4"/> Notas CRM</h4>
          {data.notes === null && <p className="text-xs text-muted-foreground">Notas indisponíveis ou sem permissão.</p>}
          {data.notes?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma nota.</p>}
          {data.notes?.slice(0, 4).map(note => <article key={note.id} className="rounded-xl border border-border bg-slate-50 p-3">
            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{note.body}</p>
            <time className="mt-2 block text-[10px] text-muted-foreground">{displayDate(note.createdAt)}</time>
          </article>)}
          {data.notes && data.notes.length > 4 && <p className="text-[11px] text-muted-foreground">Exibindo 4 notas mais recentes.</p>}
        </section>
        <section className="space-y-2" aria-label="Histórico do contato">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-600"><Clock3 className="size-4"/> Histórico CRM</h4>
          {data.timeline === null && <p className="text-xs text-muted-foreground">Histórico indisponível ou sem permissão.</p>}
          {data.timeline?.length === 0 && <p className="text-xs text-muted-foreground">Ainda não há eventos.</p>}
          {data.timeline?.slice(0, 5).map(item => <div key={item.id} className="border-l-2 border-indigo-200 pl-3 text-xs">
            <p className="font-medium">{timelineAction[item.action] || "Alteração no cadastro"}</p>
            <time className="text-[10px] text-muted-foreground">{displayDate(item.recordedAt)}</time>
          </div>)}
        </section>
        <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">Dados consultados diretamente no CRM, conforme as permissões do atendente.</p>
      </>}
    </div>
  </aside>;
}


/**
 * The same CRM surface is reused by the Inbox and CRM module.
 * Contextual tools must never invent a protocol, presence or appointment
 * before their tenant-authorized backend modules exist.
 */
export function InboxInspectorPanel({api, conversation, onOpenCrm}: {
  api: TenantApi;
  conversation: Conversation;
  onOpenCrm: () => void;
}) {
  const [tab, setTab] = useState<"contact"|"service"|"activity">("contact");
  const buttons: {id: typeof tab; label: string}[] = [
    {id:"contact",label:"Contato"},
    {id:"service",label:"Atendimento"},
    {id:"activity",label:"Atividade"},
  ];
  return <aside aria-label="Inspector da Inbox" className="flex h-full min-h-0 flex-col bg-white">
    <nav aria-label="Seções do Inspector" className="flex shrink-0 border-b border-border px-2 pt-3">
      {buttons.map(item=><button type="button" key={item.id} aria-current={tab===item.id?"page":undefined}
        className={"flex-1 border-b-2 px-1 pb-3 text-xs font-semibold "+(tab===item.id?"border-blue-600 text-blue-700":"border-transparent text-slate-500 hover:text-slate-800")}
        onClick={()=>setTab(item.id)}>{item.label}</button>)}
    </nav>
    {tab==="contact"&&<div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-border p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Ações do contato</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenCrm}><ContactRound className="size-4"/> Abrir CRM</Button>
          <Button type="button" variant="outline" size="sm" disabled title="Agenda ainda não instalada">
            <CalendarPlus className="size-4"/> Agendar (em breve)
          </Button>
        </div>
      </div>
      <CustomerContextPanel api={api} personId={conversation.crmPersonId} onOpenCrm={onOpenCrm}/>
    </div>}
    {tab==="service"&&<div className="space-y-4 overflow-y-auto p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-800"><Headset className="size-4"/> Atendimento atual</div>
      <dl className="space-y-3 rounded-xl border border-border p-4 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Estado</dt><dd className="font-semibold">{conversation.status==="open"?"Aberto":conversation.status==="pending"?"Pendente":"Resolvido"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Responsável</dt><dd className="max-w-[60%] break-all text-right">{conversation.assignedTo||"Não atribuído"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Modo</dt><dd>{conversation.handoff==="bot"?"Bot":"Humano"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Canal</dt><dd>{conversation.channel}</dd></div>
      </dl>
      <p className="text-xs leading-relaxed text-muted-foreground">Protocolos individuais, transferências entre operadores online e eventos de abertura/encerramento dependem do módulo de atendimentos. Esta tela não atribui um número fictício de protocolo.</p>
    </div>}
    {tab==="activity"&&<div className="space-y-3 overflow-y-auto p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-800"><History className="size-4"/> Histórico da conversa</div>
      <p className="text-xs leading-relaxed text-muted-foreground">A conversa mantém seu histórico contínuo. A linha do tempo de protocolos e transferências aparecerá quando os eventos auditáveis estiverem disponíveis na API.</p>
      {conversation.updatedAt&&<p className="rounded-xl border border-border p-3 text-xs">Última atividade: {displayDate(conversation.updatedAt)}</p>}
    </div>}
  </aside>;
}
