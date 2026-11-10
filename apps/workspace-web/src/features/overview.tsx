import { useEffect, useState } from "react";
import { ArrowRight, CircleCheck, ContactRound, Headphones, Inbox as InboxIcon, LockKeyhole, MessageSquareText, Sparkles, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@syndes/front-shared/badge";
import { Button } from "@syndes/front-shared/button";
import { Card, CardContent, CardHeader, CardTitle } from "@syndes/front-shared/card";
import type { TenantApi, InboxMetrics, Person, Conversation } from "@/lib/api";
import type { View } from "@/lib/views";

export function Overview({ api, onNavigate, name }: { api: TenantApi | null; onNavigate: (target: View) => void; name: string }) {
  const [metrics, setMetrics] = useState<InboxMetrics | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(Boolean(api));
  const [crmAvailable, setCrmAvailable] = useState(false);
  useEffect(() => {
    if (!api) { setMetrics(null); setPeople([]); setConversations([]); setCrmAvailable(false); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    // One forbidden/unavailable module must never make the other modules disappear.
    void Promise.allSettled([api.metrics(), api.people(), api.conversations()])
      .then(([m, p, c]) => {
        if (cancelled) return;
        setMetrics(m.status === "fulfilled" ? m.value : null);
        setPeople(p.status === "fulfilled" ? p.value : []);
        setCrmAvailable(p.status === "fulfilled");
        setConversations(c.status === "fulfilled" ? c.value : []);
        const unexpected = [m, p, c].filter(result => result.status === "rejected" &&
          !([401, 403].includes(Number((result.reason as { status?: unknown })?.status))));
        if (unexpected.length) toast.error("Alguns módulos estão temporariamente indisponíveis.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);
  const stats = [
    { title: "Conversas abertas", value: metrics?.open, icon: MessageSquareText, iconBg: "bg-[#eaf1ff] text-[#456fdb]", accent: "text-[#4267d2]" },
    { title: "Conversas pendentes", value: metrics?.pending, icon: Headphones, iconBg: "bg-[#fff5e9] text-[#d98a38]", accent: "text-[#c17924]" },
    { title: "Contatos no CRM", value: crmAvailable ? people.length : null, icon: UsersRound, iconBg: "bg-[#e8f8f1] text-[#209c70]", accent: "text-[#21896a]" },
    { title: "Concluídas", value: metrics?.resolved, icon: CircleCheck, iconBg: "bg-[#f0eafe] text-[#8b62db]", accent: "text-[#7953bf]" },
  ];
  return <div className="space-y-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="eyebrow">Seu centro de operações</p><h1 className="page-title">Bem-vindo ao {name}</h1><p className="page-subtitle">Um espaço único para acompanhar clientes, conversas e as atividades do seu negócio.</p></div>
      <Badge variant="outline" className="h-8 gap-1.5 rounded-full bg-white px-3 text-xs text-slate-600"><span className="size-1.5 rounded-full bg-emerald-500" /> Workspace de desenvolvimento</Badge>
    </div>
    {!api && <Card className="border-[#c8d8ff] bg-[#eff4ff] shadow-none"><CardContent className="flex flex-wrap items-center gap-4 py-5"><LockKeyhole className="size-6 text-[#3866cf]" /><div className="flex-1"><h3 className="font-semibold text-[#294da5]">Entre para visualizar seus dados</h3><p className="text-sm text-[#4f6590]">Os indicadores abaixo serão preenchidos após autenticação e autorização.</p></div></CardContent></Card>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((item, i) => <Card key={item.title} className="gap-4 border-[#e6eaf1] py-5 shadow-[0_8px_30px_-18px_#25396724]">
        <CardContent className="space-y-5 px-5">
          <div className="flex items-center justify-between gap-2"><span className={`flex size-11 items-center justify-center rounded-2xl ${item.iconBg}`}><item.icon className="size-5" /></span><span className="text-xs font-medium text-muted-foreground">{String(i + 1).padStart(2, "0")}</span></div>
          <div><p className="mb-2 text-sm text-muted-foreground">{item.title}</p><strong className={`text-3xl font-bold tracking-tight ${item.accent}`}>{loading ? "…" : item.value ?? "—"}</strong></div>
        </CardContent></Card>)}
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
      <Card className="gap-0 overflow-hidden border-[#e6eaf1] py-0 shadow-[0_8px_30px_-18px_#25396724]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-5"><div><CardTitle className="text-base">Conversas recentes</CardTitle><p className="mt-1 text-xs text-muted-foreground">Últimas interações na sua Inbox</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate("inbox")}>Ver Inbox <ArrowRight className="size-4" /></Button></CardHeader>
        <CardContent className="p-0">
          {conversations.length === 0 ? <div className="flex flex-col items-center gap-2 px-4 py-14 text-center"><InboxIcon className="size-8 text-muted-foreground/35" /><p className="text-sm font-medium">Nenhuma conversa para exibir</p><p className="text-xs text-muted-foreground">{api ? "Crie sua primeira conversa na Inbox." : "Faça login para consultar as conversas."}</p></div> :
            conversations.slice(0, 5).map((c) => <button key={c.id} className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left last:border-b-0 hover:bg-muted/40" onClick={() => onNavigate("inbox")}><span className="flex size-9 items-center justify-center rounded-xl bg-[#edf2ff] text-[#4b6cd8]"><MessageSquareText className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{c.subject}</strong><small className="text-xs text-muted-foreground">{c.channel} · {c.status}</small></span><ArrowRight className="size-4 text-muted-foreground" /></button>)}
        </CardContent>
      </Card>
      <Card className="gap-0 overflow-hidden border-[#e6eaf1] py-0 shadow-[0_8px_30px_-18px_#25396724]">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border py-5"><div><CardTitle className="text-base">Contatos recentes</CardTitle><p className="mt-1 text-xs text-muted-foreground">Relacionamentos do CRM</p></div><Button variant="ghost" size="sm" onClick={() => onNavigate("crm")}>Ver CRM <ArrowRight className="size-4" /></Button></CardHeader>
        <CardContent className="p-0">
          {people.length === 0 ? <div className="flex flex-col items-center gap-2 px-4 py-14 text-center"><ContactRound className="size-8 text-muted-foreground/35" /><p className="text-sm font-medium">Nenhum contato para exibir</p><p className="text-xs text-muted-foreground">{api ? "Cadastre contatos para começar." : "Faça login para consultar contatos."}</p></div> :
            people.slice(0, 5).map((person) => <button key={person.id} className="flex w-full items-center gap-3 border-b border-border px-5 py-4 text-left last:border-b-0 hover:bg-muted/40" onClick={() => onNavigate("crm")}><span className="flex size-9 items-center justify-center rounded-xl bg-[#eaf8f1] font-bold text-[#268b64]">{person.name[0]?.toUpperCase()}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{person.name}</strong><small className="text-xs text-muted-foreground">{person.email || "Contato CRM"}</small></span><ArrowRight className="size-4 text-muted-foreground" /></button>)}
        </CardContent>
      </Card>
    </div>
    <div className="flex items-center gap-3 rounded-2xl border border-[#e6eaf1] bg-white p-4 text-sm text-muted-foreground"><span className="rounded-xl bg-[#ecf3ff] p-2 text-[#5274d6]"><Sparkles className="size-5" /></span><p>Seu Workspace é modular: Inbox e CRM estão ativos. Outros módulos aparecem conforme forem instalados e autorizados.</p></div>
  </div>;
}
