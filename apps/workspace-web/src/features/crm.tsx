import { useCallback, useEffect, useState } from "react";
import { Building2, ChevronRight, ContactRound, LoaderCircle, Plus, RefreshCw, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Organization, Person, TenantApi } from "@/lib/api";

export function CrmFeature({ api }: { api: TenantApi }) {
  const [tab, setTab] = useState<"people" | "organizations">("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Person | Organization | null>(null);
  const [dialog, setDialog] = useState(false);
  const [name, setName] = useState("");
  const [detail, setDetail] = useState("");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async (query: string, target: "people" | "organizations") => {
    setLoading(true);
    try {
      if (target === "people") setPeople(await api.people(query));
      else setOrganizations(await api.organizations(query));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível consultar o CRM."); }
    finally { setLoading(false); }
  }, [api]);

  useEffect(() => { void reload("", tab); }, [reload, tab]);
  const display = tab === "people" ? people : organizations;
  const heading = tab === "people" ? "Pessoas" : "Organizações";
  const isPerson = (record: Person | Organization): record is Person => "name" in record;
  const displayName = (record: Person | Organization) => isPerson(record) ? record.name : record.legalName;
  const create = async () => {
    if (!name.trim()) { toast.error("Informe um nome."); return; }
    setSaving(true);
    try {
      if (tab === "people") await api.createPerson({ name: name.trim(), ...(detail.trim() ? { email: detail.trim() } : {}), ...(extra.trim() ? { phone: extra.trim() } : {}) });
      else await api.createOrganization({ legalName: name.trim(), ...(detail.trim() ? { tradeName: detail.trim() } : {}) });
      toast.success(tab === "people" ? "Contato cadastrado." : "Organização cadastrada.");
      setDialog(false); setName(""); setDetail(""); setExtra("");
      await reload(search, tab);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };

  return <section className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">Relacionamento</p>
        <h1 className="page-title">CRM</h1>
        <p className="page-subtitle">Seu relacionamento com clientes, organizado em um só lugar.</p>
      </div>
      <Button size="lg" className="gap-2" onClick={() => { setName(""); setDetail(""); setExtra(""); setDialog(true); }}>
        <Plus className="size-4" /> {tab === "people" ? "Novo contato" : "Nova organização"}
      </Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex rounded-xl border border-border bg-card p-1 shadow-xs">
        <button className={`segment ${tab === "people" ? "segment-active" : ""}`} onClick={() => { setTab("people"); setSelected(null); setSearch(""); }}><ContactRound className="size-4" /> Pessoas</button>
        <button className={`segment ${tab === "organizations" ? "segment-active" : ""}`} onClick={() => { setTab("organizations"); setSelected(null); setSearch(""); }}><Building2 className="size-4" /> Organizações</button>
      </div>
      <Badge variant="outline" className="rounded-full px-3 py-1 text-muted-foreground">{display.length} registros</Badge>
    </div>
    <Card className="border-[#e6eaf1] shadow-[0_5px_28px_-12px_#29334f25]">
      <CardContent className="space-y-4 p-5">
        <form className="flex gap-3" onSubmit={e => { e.preventDefault(); void reload(search, tab); }}>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input className="h-10 pl-10" value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === "people" ? "Buscar por nome, e-mail ou telefone..." : "Buscar por nome da empresa..."} />
          </div>
          <Button type="submit" variant="outline" size="lg" disabled={loading}>Buscar</Button>
          <Button type="button" size="icon-lg" variant="ghost" aria-label="Atualizar" onClick={() => void reload(search, tab)}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /></Button>
        </form>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="grid grid-cols-[1fr_auto] gap-3 bg-muted/35 px-4 py-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase"><span>{heading}</span><span>Detalhes</span></div>
          {loading && <div className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Carregando registros...</div>}
          {!loading && display.length === 0 && <div className="flex flex-col items-center gap-2 px-5 py-14 text-center"><UserRound className="mb-1 size-9 text-muted-foreground/40" /><p className="font-semibold">Nenhum registro encontrado</p><p className="text-sm text-muted-foreground">Crie seu primeiro cadastro ou tente outra busca.</p></div>}
          {!loading && display.map(record => <button key={record.id} onClick={() => setSelected(record)} className="flex w-full items-center justify-between border-t border-border px-4 py-3 text-left transition-colors hover:bg-muted/40">
            <span className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 font-semibold text-sky-700">{displayName(record).trim().charAt(0).toUpperCase()}</span><span className="min-w-0"><strong className="block truncate text-sm font-semibold">{displayName(record)}</strong><small className="block truncate text-xs text-muted-foreground">{isPerson(record) ? [record.email, record.phone].filter(Boolean).join(" · ") || "Contato" : record.tradeName || "Organização"}</small></span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>)}
        </div>
      </CardContent>
    </Card>
    <Dialog open={dialog} onOpenChange={setDialog}><DialogContent>
      <DialogHeader><DialogTitle>{tab === "people" ? "Novo contato" : "Nova organização"}</DialogTitle><DialogDescription>Os dados serão salvos exclusivamente no tenant selecionado.</DialogDescription></DialogHeader>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void create(); }}>
        <div className="space-y-1.5"><label className="text-sm font-semibold" htmlFor="record-name">{tab === "people" ? "Nome completo" : "Razão social"}</label><Input id="record-name" required maxLength={160} value={name} onChange={e => setName(e.target.value)} placeholder="Digite o nome" /></div>
        <div className="space-y-1.5"><label className="text-sm font-semibold" htmlFor="record-detail">{tab === "people" ? "E-mail (opcional)" : "Nome fantasia (opcional)"}</label><Input id="record-detail" type={tab === "people" ? "email" : "text"} value={detail} onChange={e => setDetail(e.target.value)} /></div>
        {tab === "people" && <div className="space-y-1.5"><label className="text-sm font-semibold" htmlFor="record-phone">Telefone (opcional)</label><Input id="record-phone" value={extra} onChange={e => setExtra(e.target.value)} /></div>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setDialog(false)}>Cancelar</Button><Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar cadastro"}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent>
      <DialogHeader><DialogTitle>{selected ? displayName(selected) : "Detalhes"}</DialogTitle><DialogDescription>Informações do registro no CRM.</DialogDescription></DialogHeader>
      {selected && <div className="space-y-3 rounded-xl bg-muted/40 p-4 text-sm"><p><span className="font-medium text-muted-foreground">Identificador:</span> <span className="break-all">{selected.id}</span></p>
        {isPerson(selected) ? <><p><span className="text-muted-foreground">E-mail:</span> {selected.email || "Não informado"}</p><p><span className="text-muted-foreground">Telefone:</span> {selected.phone || "Não informado"}</p></> : <p><span className="text-muted-foreground">Nome fantasia:</span> {selected.tradeName || "Não informado"}</p>}
      </div>}
    </DialogContent></Dialog>
  </section>;
}
