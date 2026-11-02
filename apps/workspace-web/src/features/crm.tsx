import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Building2, ChevronLeft, ChevronRight, CircleAlert, ContactRound, Download, FileUp, LoaderCircle, Plus, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CrmPersonDetail } from "@/features/crm-person-detail";
import type { CrmCapabilities, CrmCapability, CrmDuplicate, Organization, Person, TenantApi } from "@/lib/api";

type Kind = "people" | "organizations";
type RecordItem = Person | Organization;
const titleOf = (record: RecordItem) => "name" in record ? record.name : record.legalName;
const isPerson = (record: RecordItem): record is Person => "name" in record;
type EditForm = { name: string; detail: string; extra: string };
const empty: EditForm = { name: "", detail: "", extra: "" };
const PAGE_SIZE = 25;

export function CrmFeature({ api }: { api: TenantApi }) {
  const [caps, setCaps] = useState<CrmCapabilities | null>(null);
  const [accessError, setAccessError] = useState("");
  const [tab, setTab] = useState<Kind>("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const listRequest = useRef(0);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [editing, setEditing] = useState<{ kind: Kind; id: string | null } | null>(null);
  const [form, setForm] = useState<EditForm>(empty);
  const [duplicateWarning, setDuplicateWarning] = useState<CrmDuplicate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<RecordItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [importing, setImporting] = useState(false);
  const can = useCallback((cap: CrmCapability) => caps?.[cap] === true, [caps]);

  useEffect(() => {
    let active = true;
    void api.crmCapabilities().then(value => { if(active) { setCaps(value); setAccessError(""); } })
      .catch(error => { if(active) { setCaps(null); setAccessError(error instanceof Error ? error.message : "Não foi possível consultar suas permissões."); } });
    return () => { active = false; };
  }, [api]);

  const reload = useCallback(async (kind: Kind, q: string, pageIndex = 0) => {
    const request = ++listRequest.current;
    setLoading(true);
    setListError("");
    try {
      if (kind === "people") {
        const results=await api.people(q,pageIndex*PAGE_SIZE,PAGE_SIZE);
        if (request===listRequest.current) setPeople(results);
      } else {
        const results=await api.organizations(q,pageIndex*PAGE_SIZE,PAGE_SIZE);
        if (request===listRequest.current) setOrganizations(results);
      }
    } catch (error) {
      if(request===listRequest.current)setListError(error instanceof Error ? error.message : "Falha ao consultar CRM.");
    } finally { if(request===listRequest.current)setLoading(false); }
  }, [api]);
  useEffect(() => {
    if (caps === null) return;
    if (!can(tab === "people" ? "people.read" : "organizations.read")) return;
    void reload(tab, search, page);
  }, [caps, can, reload, search, tab, page]);
  const records = tab === "people" ? people : organizations;
  const ableToRead = can(tab === "people" ? "people.read" : "organizations.read");
  const ableToWrite = can(tab === "people" ? "people.write" : "organizations.write");
  const openCreate = () => { setForm(empty); setDuplicateWarning(null); setEditing({kind:tab,id:null}); };
  const openEdit = (record: RecordItem) => {
    const kind: Kind = isPerson(record) ? "people" : "organizations";
    if (!can(kind === "people" ? "people.write" : "organizations.write")) return;
    setForm(isPerson(record) ? {name:record.name,detail:record.email ?? "",extra:record.phone ?? ""} :
      {name:record.legalName,detail:record.tradeName ?? "",extra:record.taxId ?? ""});
    setDuplicateWarning(null);
    setEditing({kind,id:record.id});
  };
  const changeField = (key: keyof EditForm, value: string) => {
    setForm(previous => ({...previous,[key]:value}));
    setDuplicateWarning(null);
  };
  const save = async () => {
    if (!editing || !form.name.trim() || saving || !can(editing.kind === "people" ? "people.write" : "organizations.write")) return;
    setSaving(true);
    try {
      const person = editing.kind === "people";
      const input = person ? {name:form.name.trim(),email:form.detail.trim() || null,phone:form.extra.trim() || null} :
        {legalName:form.name.trim(),tradeName:form.detail.trim() || null,taxId:form.extra.trim() || null};
      if (person && (form.detail.trim() || form.extra.trim()) && duplicateWarning === null && can("people.read")) {
        const found = await api.crmDuplicates({
          ...(form.detail.trim() ? {email:form.detail.trim()} : {}),
          ...(form.extra.trim() ? {phone:form.extra.trim()} : {}),
          ...(editing.id ? {excludeId:editing.id} : {}),
        });
        if (found.length) { setDuplicateWarning(found); return; }
      }
      const result = person
        ? editing.id ? await api.updatePerson(editing.id, input as {name:string;email?:string|null;phone?:string|null})
          : await api.createPerson({name:form.name.trim(),...(form.detail.trim()?{email:form.detail.trim()}:{}),...(form.extra.trim()?{phone:form.extra.trim()}: {})})
        : editing.id ? await api.updateOrganization(editing.id, input as {legalName:string;tradeName?:string|null;taxId?:string|null})
          : await api.createOrganization({legalName:form.name.trim(),...(form.detail.trim()?{tradeName:form.detail.trim()}: {}),...(form.extra.trim()?{taxId:form.extra.trim()}: {})});
      setEditing(null);
      setDuplicateWarning(null);
      setSelected(result);
      toast.success(editing.id ? "Cadastro atualizado." : "Cadastro criado.");
      if(!editing.id) setPage(0);
      await reload(editing.kind, search, editing.id ? page : 0);
    } catch(error) { toast.error(error instanceof Error ? error.message : "Falha ao salvar cadastro."); }
    finally { setSaving(false); }
  };
  const archive = async () => {
    if (!archiveTarget || saving) return;
    const person = isPerson(archiveTarget);
    if(!can(person ? "people.write" : "organizations.write")) return;
    setSaving(true);
    try {
      const result = person ? await api.archivePerson(archiveTarget.id) : await api.archiveOrganization(archiveTarget.id);
      if(!result)throw new Error("O registro já estava arquivado ou não está disponível.");
      toast.success("Registro arquivado.");
      setSelected(null);setArchiveTarget(null);
      await reload(person ? "people" : "organizations", search, page);
    } catch(error) { toast.error(error instanceof Error ? error.message : "Não foi possível arquivar."); }
    finally { setSaving(false); }
  };
  const exportCsv = async () => {
    if (!can("people.read")) return;
    try {
      const result = await api.exportPeopleCsv();
      const blob = new Blob(["\uFEFF",result],{type:"text/csv;charset=utf-8"});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href=url;anchor.download="syndes-contatos.csv";anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação iniciada.");
    } catch(error) { toast.error(error instanceof Error ? error.message : "Falha ao exportar."); }
  };
  const importCsv = async () => {
    if (!can("people.write") || !csv.trim() || importing) return;
    setImporting(true);
    try {
      const result=await api.importPeopleCsv(csv);
      toast.success(result.imported+" contatos importados.");
      setCsv("");setImportOpen(false);await reload("people",search);
    } catch(error) { toast.error(error instanceof Error ? error.message : "Falha na importação."); }
    finally { setImporting(false); }
  };
  const selectedPerson = selected && isPerson(selected) ? selected : null;
  const selectedOrg = selected && !isPerson(selected) ? selected : null;
  const title = tab === "people" ? "Pessoas" : "Organizações";

  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="eyebrow">Relacionamento</p><h1 className="page-title">CRM</h1>
        <p className="page-subtitle">Contatos, organizações, vínculos e histórico no mesmo workspace.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {tab === "people" && can("people.read") && <Button size="sm" variant="outline" onClick={() => void exportCsv()}><Download className="size-4"/> Exportar CSV</Button>}
        {tab === "people" && can("people.write") && <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><FileUp className="size-4"/> Importar CSV</Button>}
        {ableToWrite && <Button size="lg" onClick={openCreate}><Plus className="size-4"/> {tab === "people" ? "Novo contato" : "Nova organização"}</Button>}
      </div>
    </div>
    {accessError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Não foi possível carregar as permissões: {accessError} <Button size="sm" variant="outline" onClick={() => void api.crmCapabilities().then(value=>{setCaps(value);setAccessError("");}).catch(()=>toast.error("Permissões indisponíveis."))}>Tentar novamente</Button></p>}
    {caps === null && !accessError && <p className="text-sm text-muted-foreground">Carregando permissões de acesso...</p>}
    {caps !== null && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-border bg-card p-1">
          {can("people.read") && <button type="button" className={"segment "+(tab==="people"?"segment-active":"")} onClick={() => {setTab("people");setSearch("");setQuery("");setPage(0);setSelected(null);}}><ContactRound className="size-4"/> Pessoas</button>}
          {can("organizations.read") && <button type="button" className={"segment "+(tab==="organizations"?"segment-active":"")} onClick={() => {setTab("organizations");setSearch("");setQuery("");setPage(0);setSelected(null);}}><Building2 className="size-4"/> Organizações</button>}
        </div>
        <Badge variant="outline">{records.length} registros · página {page+1}</Badge>
      </div>
      {!ableToRead ? <Card><CardContent className="p-6 text-sm">Seu perfil não tem permissão de leitura para {title.toLowerCase()}.</CardContent></Card> :
      <Card className="border-[#e6eaf1]"><CardContent className="space-y-4 p-5">
        <form className="flex flex-wrap gap-2" onSubmit={event=>{event.preventDefault();setSearch(query);setPage(0);void reload(tab,query,0);}}>
          <div className="relative w-full min-w-0 sm:flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"/>
            <Input aria-label="Pesquisar registros" className="pl-10" value={query} onChange={event=>setQuery(event.target.value)}
              placeholder={tab==="people"?"Buscar nome, e-mail ou telefone":"Buscar razão social, fantasia ou CPF/CNPJ"}/></div>
          <Button variant="outline" type="submit" disabled={loading}>Buscar</Button>
          <Button variant="ghost" size="icon-lg" type="button" aria-label="Atualizar CRM" onClick={()=>void reload(tab,search,page)}><RefreshCw className={loading?"size-4 animate-spin":"size-4"}/></Button>
        </form>
        {listError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{listError}</p>}
        <div className="overflow-hidden rounded-xl border">
          <div className="grid grid-cols-[1fr_auto] border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase text-muted-foreground"><span>{title}</span><span>Abrir ficha</span></div>
          {loading && <p className="flex items-center gap-2 px-4 py-7 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin"/> Carregando...</p>}
          {!loading && !listError && records.length===0 && <p className="px-4 py-9 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</p>}
          {!loading && records.map(record=><button type="button" key={record.id} onClick={()=>setSelected(record)}
            className="flex w-full items-center justify-between gap-4 border-b px-4 py-3 text-left last:border-b-0 hover:bg-muted/50">
            <span className="min-w-0"><strong className="block truncate text-sm">{titleOf(record)}</strong>
              <span className="block truncate text-xs text-muted-foreground">{isPerson(record)?([record.email,record.phone].filter(Boolean).join(" · ")||"Sem contato informado"):(record.tradeName||record.taxId||"Organização")}</span></span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground"/></button>)}
        </div>
        <nav aria-label="Paginação de registros" className="flex items-center justify-end gap-3">
          <Button type="button" size="sm" variant="outline" disabled={loading||page===0}
            onClick={()=>setPage(p=>Math.max(0,p-1))}><ChevronLeft className="size-4"/> Anterior</Button>
          <span className="text-xs text-muted-foreground">Página {page+1}</span>
          <Button type="button" size="sm" variant="outline" disabled={loading||records.length<PAGE_SIZE||page>=3999}
            onClick={()=>setPage(p=>p+1)}>Próxima <ChevronRight className="size-4"/></Button>
        </nav>
      </CardContent></Card>}
    </>}
    <Sheet open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelected(null);}}>
      <SheetContent side="right" showCloseButton={false} className="crm-record-sheet min-w-0 gap-0 overflow-y-auto overscroll-contain p-0">
        <SheetHeader className="sticky top-0 z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b bg-white px-4 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <SheetTitle className="break-words pr-1">{selected ? titleOf(selected) : "Ficha"}</SheetTitle>
            <SheetDescription>{selectedPerson?"Ficha do contato":"Ficha da organização"}</SheetDescription>
          </div>
          <SheetClose aria-label="Fechar ficha" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
            <X className="size-5" />
          </SheetClose>
        </SheetHeader>
        {selectedPerson && <CrmPersonDetail key={selectedPerson.id} api={api} person={selectedPerson} can={can} onEdit={()=>openEdit(selectedPerson)} onArchive={()=>setArchiveTarget(selectedPerson)}/>}
        {selectedOrg && <div className="space-y-4 p-4 sm:p-6">
          <p className="text-sm"><strong>Razão social:</strong> {selectedOrg.legalName}</p>
          <p className="text-sm"><strong>Nome fantasia:</strong> {selectedOrg.tradeName||"Não informado"}</p>
          <p className="text-sm"><strong>CPF/CNPJ:</strong> {selectedOrg.taxId||"Não informado"}</p>
          {can("organizations.write") && <div className="flex gap-2"><Button onClick={()=>openEdit(selectedOrg)}>Editar</Button>
            <Button variant="destructive" onClick={()=>setArchiveTarget(selectedOrg)}><Archive className="size-4"/> Arquivar</Button></div>}
        </div>}
      </SheetContent>
    </Sheet>
    <Dialog open={Boolean(editing)} onOpenChange={open=>{if(!open&&!saving)setEditing(null);}}>
      <DialogContent><DialogHeader><DialogTitle>{editing?.id?"Editar cadastro":"Novo cadastro"}</DialogTitle>
        <DialogDescription>As alterações são verificadas pelas permissões do Core Host.</DialogDescription></DialogHeader>
        {editing && <form className="space-y-3" onSubmit={event=>{event.preventDefault();void save();}}>
          <label className="block space-y-1 text-sm font-medium">{editing.kind==="people"?"Nome completo":"Razão social"}
            <Input aria-label="Nome do cadastro" required maxLength={160} value={form.name} onChange={event=>changeField("name",event.target.value)}/></label>
          <label className="block space-y-1 text-sm font-medium">{editing.kind==="people"?"E-mail":"Nome fantasia"}
            <Input aria-label="Contato principal" type={editing.kind==="people"?"email":"text"} maxLength={254} value={form.detail} onChange={event=>changeField("detail",event.target.value)}/></label>
          <label className="block space-y-1 text-sm font-medium">{editing.kind==="people"?"Telefone":"CPF/CNPJ"}
            <Input aria-label="Dado complementar" value={form.extra} maxLength={32} onChange={event=>changeField("extra",event.target.value)}/></label>
          {duplicateWarning?.length ? <div role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex items-center gap-2 font-semibold"><CircleAlert className="size-4"/> Possíveis cadastros duplicados</div>
            {duplicateWarning.map(record=><p key={record.id}>{record.name} — {record.reason==="email"?"mesmo e-mail":"mesmo telefone"}</p>)}
            <p className="mt-2">Revise os registros antes de confirmar. Clique novamente em Salvar para continuar.</p></div>:null}
          <DialogFooter><Button type="button" variant="outline" onClick={()=>setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button type="submit" disabled={saving||!form.name.trim()}>{saving?"Salvando...":duplicateWarning?.length?"Confirmar mesmo assim":"Salvar cadastro"}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>
    <Dialog open={Boolean(archiveTarget)} onOpenChange={open=>{if(!open)setArchiveTarget(null);}}>
      <DialogContent><DialogHeader><DialogTitle>Arquivar registro?</DialogTitle><DialogDescription>O registro ficará fora da listagem ativa. Esta ação não exclui seus dados permanentemente.</DialogDescription></DialogHeader>
        <p className="text-sm font-medium">{archiveTarget?titleOf(archiveTarget):""}</p>
        <DialogFooter><Button variant="outline" onClick={()=>setArchiveTarget(null)}>Cancelar</Button><Button variant="destructive" disabled={saving} onClick={()=>void archive()}><Archive className="size-4"/> Confirmar arquivamento</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={importOpen} onOpenChange={setImportOpen}>
      <DialogContent><DialogHeader><DialogTitle>Importar contatos CSV</DialogTitle><DialogDescription>Arquivo com colunas name,email,phone, validado pelo Core Host. Confirme antes de importar.</DialogDescription></DialogHeader>
        <label className="block space-y-2 text-sm font-medium">Arquivo CSV
          <Input type="file" accept=".csv,text/csv" aria-label="Selecionar CSV" onChange={async event=>{
            const file=event.target.files?.[0];if(!file)return;
            if(file.size>1024*1024){toast.error("Arquivo muito grande para importação do MVP.");return;}
            setCsv(await file.text());
          }}/></label>
        <Textarea readOnly value={csv.slice(0,900)} rows={5} aria-label="Prévia do CSV" placeholder="Prévia do arquivo selecionado"/>
        <DialogFooter><Button variant="outline" onClick={()=>setImportOpen(false)}>Cancelar</Button>
          <Button disabled={!csv.trim()||importing} onClick={()=>void importCsv()}>{importing?"Importando...":"Confirmar importação"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
