import { useCallback, useEffect, useState } from "react";
import { Archive, Building2, Clock3, ContactRound, FileText, Link2, Mail, NotebookPen, PenLine, Phone, Plus, Radio, RefreshCw, Tags, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CrmCapability, CrmChannel, CrmEmployee, CrmNote, CrmTag, CrmTimelineEvent, Organization, Person, TenantApi } from "@/lib/api";

type ReadState<T> = { data: T | null; error: string | null };
const empty = <T,>(): ReadState<T> => ({ data: null, error: null });
const fmt = (raw: string) => {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"});
};

export function CrmPersonDetail({ api, person, can, onEdit, onArchive }: {
  api: TenantApi; person: Person; can: (cap: CrmCapability) => boolean; onEdit: () => void; onArchive: () => void;
}) {
  const [notes, setNotes] = useState<ReadState<CrmNote[]>>(empty);
  const [timeline, setTimeline] = useState<ReadState<CrmTimelineEvent[]>>(empty);
  const [organizations, setOrganizations] = useState<ReadState<Organization[]>>(empty);
  const [tags, setTags] = useState<ReadState<CrmTag[]>>(empty);
  const [tagCatalog, setTagCatalog] = useState<CrmTag[]>([]);
  const [selectedTag, setSelectedTag] = useState("");
  const [channels, setChannels] = useState<ReadState<CrmChannel[]>>(empty);
  const [employee, setEmployee] = useState<ReadState<CrmEmployee | null>>(empty);
  const [choices, setChoices] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState("");
  const [noteText, setNoteText] = useState("");
  const [tagText, setTagText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [externalId, setExternalId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const refresh = useCallback(() => setRefreshIndex(n => n+1), []);
  const load = useCallback(async <T,>(enabled: boolean, fn: () => Promise<T>, setter: (value: ReadState<T>) => void, cancelled: () => boolean) => {
    if(!enabled) { setter({data:null,error:"Sem permissão de leitura."});return; }
    try {const data=await fn();if(!cancelled())setter({data,error:null});}
    catch(error){if(!cancelled())setter({data:null,error:error instanceof Error?error.message:"Consulta indisponível."});}
  }, []);
  useEffect(() => {
    let cancelled=false;
    const stale=()=>cancelled;
    void load(can("notes.read"),()=>api.personNotes(person.id),setNotes,stale);
    void load(can("people.read"),()=>api.personTimeline(person.id),setTimeline,stale);
    void load(can("organizations.read"),()=>api.personOrganizations(person.id),setOrganizations,stale);
    void load(can("tags.read"),()=>api.personTags(person.id),setTags,stale);
    if(can("tags.read") && can("tags.write"))void api.crmAllTags().then(v=>{if(!cancelled)setTagCatalog(v);}).catch(()=>{if(!cancelled)setTagCatalog([]);});
    void load(can("channels.read"),()=>api.crmChannels(person.id),setChannels,stale);
    void load(can("employees.read"),()=>api.crmPersonEmployee(person.id),setEmployee,stale);
    if(can("organizations.read") && can("relationships.write"))void api.organizations().then(v=>{if(!cancelled)setChoices(v);}).catch(()=>{if(!cancelled)setChoices([]);});
    return ()=>{cancelled=true;};
  }, [api, person.id, can, load, refreshIndex]);

  const mutate = async (work:()=>Promise<unknown>, success:string, clear:()=>void) => {
    if(saving)return;
    setSaving(true);
    try {await work();clear();toast.success(success);refresh();}
    catch(error){toast.error(error instanceof Error?error.message:"Operação não autorizada ou indisponível.");}
    finally{setSaving(false);}
  };
  const myEmployee = employee.data ? [employee.data] : [];
  const displayError = (text:string|null) => text?<p role="status" className="text-xs text-amber-800">{text}</p>:null;

  return <div className="grid min-w-0 grid-cols-1 gap-5 p-4 sm:gap-6 sm:p-6 lg:grid-cols-2">
    <section className="min-w-0 space-y-3 lg:col-span-2" aria-label="Informações pessoais">
      <div className="flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-700"><ContactRound className="size-6"/></div>
        <div className="min-w-0"><strong className="block truncate">{person.name}</strong><span className="text-xs text-muted-foreground">Contato CRM</span></div></div>
      <dl className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
        <div className="flex gap-2"><Mail className="size-4 shrink-0"/><dd className="break-all">{person.email || "E-mail não informado"}</dd></div>
        <div className="flex gap-2"><Phone className="size-4 shrink-0"/><dd>{person.phone || "Telefone não informado"}</dd></div>
      </dl>
      {can("people.write") && <div className="flex gap-2"><Button size="sm" onClick={onEdit}><PenLine className="size-4"/> Editar</Button>
        <Button size="sm" variant="outline" onClick={onArchive}><Archive className="size-4"/> Arquivar</Button></div>}
    </section>
    <section aria-label="Organizações vinculadas" className="min-w-0 space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Building2 className="size-4"/> Organizações</h3>
      {displayError(organizations.error)}
      {organizations.data?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma empresa vinculada.</p>}
      {organizations.data?.map(org=><div key={org.id} className="flex min-w-0 flex-wrap items-start justify-between gap-3 rounded-lg border p-3 text-sm">
        <span className="min-w-0 flex-1 break-words"><strong>{org.tradeName || org.legalName}</strong>
        {org.tradeName && <p className="text-xs text-muted-foreground">{org.legalName}</p>}</span>
        {can("relationships.write") && <Button size="sm" variant="outline" disabled={saving}
          aria-label={"Desvincular organização "+org.legalName}
          onClick={()=>void mutate(()=>api.unlinkPersonOrganization(person.id,org.id),"Organização desvinculada.",()=>{})}>Desvincular</Button>}</div>)}
      {can("relationships.write") && can("organizations.read") && <form className="flex min-w-0 flex-col gap-2 xl:flex-row" onSubmit={event=>{
        event.preventDefault();if(!selectedOrg)return;
        void mutate(()=>api.linkPersonOrganization(person.id,selectedOrg),"Organização vinculada.",()=>setSelectedOrg(""));
      }}>
        <select aria-label="Selecionar organização" value={selectedOrg} onChange={event=>setSelectedOrg(event.target.value)}
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-white px-2 text-sm xl:flex-1">
          <option value="">Selecione uma organização</option>
          {choices.filter(org=>!organizations.data?.some(linked=>linked.id===org.id)).map(org=><option value={org.id} key={org.id}>{org.tradeName||org.legalName}</option>)}
        </select><Button className="w-full xl:w-auto" size="sm" type="submit" disabled={!selectedOrg||saving}><Link2 className="size-4"/> Vincular</Button>
      </form>}
    </section>
    <section aria-label="Tags do contato" className="min-w-0 space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Tags className="size-4"/> Tags</h3>
      {displayError(tags.error)}
      {tags.data?.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag vinculada.</p>}
      <div className="flex flex-wrap gap-1.5">{tags.data?.map(tag=><span className="inline-flex items-center gap-1" key={tag.id}>
        <Badge variant="secondary">{tag.label}</Badge>
        {can("tags.write") && <Button size="sm" variant="ghost" className="h-6 px-1 text-xs" disabled={saving}
          aria-label={"Desvincular tag "+tag.label}
          onClick={()=>void mutate(()=>api.unlinkPersonTag(person.id,tag.id),"Tag desvinculada.",()=>{})}>Remover</Button>}</span>)}</div>
      {can("tags.read") && can("tags.write") && <form className="flex min-w-0 flex-col gap-2 xl:flex-row" onSubmit={event=>{event.preventDefault();if(!selectedTag)return;
        void mutate(()=>api.tagPerson(person.id,selectedTag),"Tag existente vinculada.",()=>setSelectedTag(""));
      }}>
        <select aria-label="Selecionar tag existente" value={selectedTag} onChange={event=>setSelectedTag(event.target.value)}
          className="h-10 w-full min-w-0 rounded-lg border border-input bg-white px-2 text-sm xl:flex-1">
          <option value="">Tags já cadastradas</option>
          {tagCatalog.filter(tag=>!tags.data?.some(assigned=>assigned.id===tag.id)).map(tag=><option key={tag.id} value={tag.id}>{tag.label}</option>)}
        </select>
        <Button className="w-full xl:w-auto" type="submit" size="sm" disabled={saving||!selectedTag}>Vincular</Button>
      </form>}
      {can("tags.write") && <form className="flex min-w-0 flex-col gap-2 xl:flex-row" onSubmit={event=>{event.preventDefault();if(!tagText.trim())return;
        void mutate(async()=>{
          const tag=await api.createTag(tagText.trim());
          await api.tagPerson(person.id,tag.id);
        },"Tag vinculada.",()=>setTagText(""));
      }}>
        <Input aria-label="Nova tag" maxLength={80} value={tagText} onChange={event=>setTagText(event.target.value)} placeholder="Nova tag"/>
        <Button className="w-full xl:w-auto" size="sm" type="submit" disabled={!tagText.trim()||saving}><Plus className="size-4"/> Adicionar</Button></form>}
    </section>
    <section aria-label="Notas do contato" className="min-w-0 space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><NotebookPen className="size-4"/> Notas</h3>
      {displayError(notes.error)}
      {notes.data?.length===0 && <p className="text-xs text-muted-foreground">Nenhuma nota registrada.</p>}
      {notes.data?.map(note=><article key={note.id} className="rounded-xl bg-amber-50 p-3 text-sm">
        <p className="whitespace-pre-wrap break-words">{note.body}</p><time className="mt-1 block text-[11px] text-muted-foreground">{fmt(note.createdAt)}</time>
      </article>)}
      {can("notes.write") && <form className="space-y-2" onSubmit={event=>{event.preventDefault();if(!noteText.trim())return;
        void mutate(()=>api.createCrmNote(person.id,noteText.trim()),"Nota registrada.",()=>setNoteText(""));
      }}>
        <Textarea aria-label="Escrever nota CRM" rows={2} maxLength={3000} value={noteText} onChange={event=>setNoteText(event.target.value)} placeholder="Nota interna do contato..."/>
        <Button size="sm" disabled={!noteText.trim()||saving} type="submit"><Plus className="size-4"/> Registrar nota</Button></form>}
    </section>
    <section aria-label="Canais vinculados" className="min-w-0 space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Radio className="size-4"/> Identidades de canais</h3>
      {displayError(channels.error)}
      {channels.data?.length===0 && <p className="text-xs text-muted-foreground">Nenhum canal vinculado.</p>}
      {channels.data?.map(value=><div className="rounded-lg border p-2 text-xs" key={value.id}><strong>{value.channel}</strong> — {value.displayName||value.externalId}</div>)}
      {can("channels.write") && <form className="space-y-2" onSubmit={event=>{event.preventDefault();if(!externalId.trim())return;
        void mutate(()=>api.linkCrmChannel(person.id,{channel,externalId:externalId.trim(),...(displayName.trim()?{displayName:displayName.trim()}: {})}),"Canal vinculado.",()=>{setExternalId("");setDisplayName("");});
      }}>
        <select aria-label="Canal" className="h-9 rounded-lg border border-input px-2 text-sm" value={channel} onChange={event=>setChannel(event.target.value)}>
          <option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="email">E-mail</option>
        </select>
        <Input aria-label="ID externo do canal" maxLength={256} placeholder="Identificador externo" value={externalId} onChange={event=>setExternalId(event.target.value)}/>
        <Input aria-label="Nome exibido no canal" maxLength={160} placeholder="Nome exibido (opcional)" value={displayName} onChange={event=>setDisplayName(event.target.value)}/>
        <Button size="sm" disabled={saving||!externalId.trim()} type="submit">Vincular canal</Button></form>}
    </section>
    <section aria-label="Funcionário vinculado" className="min-w-0 space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><UsersRound className="size-4"/> Funcionário</h3>
      {displayError(employee.error)}
      {myEmployee.map(item=><p key={item.id} className="text-sm">{item.jobTitle} — {item.active?"Ativo":"Inativo"}</p>)}
      {can("employees.write") && myEmployee.length===0 && <form className="flex min-w-0 flex-col gap-2 xl:flex-row" onSubmit={event=>{event.preventDefault();if(!jobTitle.trim())return;
        void mutate(()=>api.createEmployee(person.id,jobTitle.trim()),"Funcionário vinculado.",()=>setJobTitle(""));
      }}>
        <Input aria-label="Cargo do funcionário" maxLength={160} value={jobTitle} onChange={event=>setJobTitle(event.target.value)} placeholder="Cargo"/>
        <Button className="w-full xl:w-auto" size="sm" type="submit" disabled={saving||!jobTitle.trim()}>Registrar</Button></form>}
    </section>
    <section aria-label="Histórico do contato" className="min-w-0 space-y-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Clock3 className="size-4"/> Histórico</h3>
      {displayError(timeline.error)}
      {timeline.data?.length===0 && <p className="text-xs text-muted-foreground">Sem histórico disponível.</p>}
      {timeline.data?.map(entry=><p key={entry.id} className="border-l-2 border-indigo-200 pl-3 text-xs">
        <span className="block font-medium">{entry.action.replaceAll("_"," ")}</span>
        <time className="text-muted-foreground">{fmt(entry.recordedAt)}</time></p>)}
      <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="size-4"/> Atualizar ficha</Button>
    </section>
    <p className="min-w-0 text-xs text-muted-foreground lg:col-span-2"><FileText className="mr-1 inline size-3"/> Recursos exibidos conforme as capacidades do usuário e autorização do Core Host.</p>
  </div>;
}
