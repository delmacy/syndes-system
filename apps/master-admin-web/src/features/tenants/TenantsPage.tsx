import {type Dispatch,type SetStateAction} from "react";
import {ChevronDown,ChevronLeft,ChevronRight,Filter,Lock,Search} from "lucide-react";
import {Button,Input} from "@syndes/front-shared";
import type {TenantPage} from "../../api";
import {TenantTable} from "./TenantTable";
export function TenantsPage({tenants,query,onQueryChange,status,onStatusChange,page,setPage,onSelect}:{
 tenants:TenantPage|null;query:string;onQueryChange:(query:string)=>void;
 status:string;onStatusChange:(status:string)=>void;page:number;
 setPage:Dispatch<SetStateAction<number>>;onSelect:(id:string)=>void
}){return <>

     <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#6885bd]">Seu portfólio</div><h1 className="text-[33px] font-bold tracking-[-.05em] text-[#17233c]">Clientes da plataforma</h1><p className="mt-1 text-sm text-[#8291a8]">Um tenant por cliente comercial, com banco de dados dedicado.</p></div>
      <div className="flex items-center gap-2 rounded-xl border border-[#e3eaf5] bg-white px-3 py-2.5 text-xs text-[#7b8ba6]"><Lock className="size-4"/> Cadastro via provisionamento seguro</div>
     </div>
     <section className="overflow-hidden rounded-[20px] border border-[#e5eaf3] bg-white shadow-sm"><div className="flex flex-col justify-between gap-4 border-b border-[#eef1f7] px-6 py-5 md:flex-row md:items-center"><div><h2 className="text-sm font-bold text-[#263856]">Diretório de tenants</h2><p className="mt-1 text-[12px] text-[#97a4b9]">{tenants?.total??"—"} clientes correspondentes</p></div><div className="flex flex-col gap-2 sm:flex-row">
      <label className="flex items-center gap-2 rounded-xl border border-[#dfe6f1] bg-[#fbfcff] px-3 py-2.5 text-slate-400"><Search className="size-4"/><Input unstyled type="search" value={query} onChange={e=>onQueryChange(e.target.value)} placeholder="Pesquisar nome ou ID..." aria-label="Pesquisar clientes" className="w-full bg-transparent text-[12px] text-slate-700 outline-none placeholder:text-[#9aa7ba] sm:w-44"/></label>
      <label className="flex items-center gap-2 rounded-xl border border-[#dfe6f1] bg-white px-3 py-2 text-[#8491a6]"><Filter className="size-4"/><select aria-label="Filtrar status" className="bg-transparent text-[12px] font-semibold text-slate-600 outline-none" value={status} onChange={e=>onStatusChange(e.target.value)}><option value="all">Todos os status</option><option value="active">Ativos</option><option value="provisioned">Provisionados</option><option value="suspended">Suspensos</option></select><ChevronDown className="size-3.5"/></label></div></div>
      {tenants?<TenantTable items={tenants.items} onSelect={onSelect}/>:<p role="status" className="px-6 py-8 text-xs text-slate-500">Carregando diretório...</p>}
      <div className="flex items-center justify-between gap-3 border-t border-[#eef1f7] px-6 py-4 text-xs text-slate-500"><span>Página {tenants?.page??1} · {tenants?.total??0} clientes</span><div className="flex gap-2"><Button unstyled type="button" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30" aria-label="Página anterior"><ChevronLeft className="size-4"/></Button><Button unstyled type="button" disabled={!tenants||page*tenants.pageSize>=tenants.total} onClick={()=>setPage(p=>p+1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30" aria-label="Próxima página"><ChevronRight className="size-4"/></Button></div></div>
     </section>

</>;}