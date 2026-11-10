import {ArrowRight,Building2,CheckCircle2,Clock3,ShieldOff,Users,UsersRound} from "lucide-react";
import {Button,Card} from "@syndes/front-shared";
import type {Overview,TenantPage} from "../../api";
import {TenantTable} from "../tenants/TenantTable";
function Metric({icon:Icon,label,value,hint,accent}:{icon:typeof Users;label:string;value:number|undefined;hint:string;accent:"blue"|"green"|"amber"|"red"}){
 const styles={blue:"bg-blue-50 text-blue-600",green:"bg-emerald-50 text-emerald-600",amber:"bg-amber-50 text-amber-600",red:"bg-rose-50 text-rose-600"};
 return <Card unstyled className="rounded-[19px] border border-[#e6ebf4] bg-white px-5 py-5 shadow-[0_3px_14px_rgba(33,52,94,0.025)]">
  <div className="flex items-center justify-between">
    <span className="text-[12px] font-medium text-[#70809b]">{label}</span>
    <span className={"flex size-9 items-center justify-center rounded-xl "+styles[accent]}><Icon className="size-[17px]"/></span>
  </div>
  <div className="mt-3 text-[31px] font-bold leading-none tracking-[-0.045em] text-[#182340]">{value===undefined?"—":value.toLocaleString("pt-BR")}</div>
  <p className="mt-2 text-[11px] text-[#97a2b5]">{hint}</p>
 </Card>;
}

function EmptyOverview({onClients}:{onClients:()=>void}){
 return <div className="rounded-[19px] border border-dashed border-[#d7e0ee] bg-white p-10 text-center"><Building2 className="mx-auto size-8 text-slate-300"/><h3 className="mt-4 font-semibold text-[#243355]">Nenhum cliente cadastrado ainda</h3><p className="mt-2 text-sm text-[#8693a9]">O diretório será preenchido pelos tenants provisionados no Control Plane.</p><Button unstyled onClick={onClients} className="mt-5 rounded-xl border border-[#dce4f4] px-4 py-2 text-xs font-semibold text-indigo-600">Ver diretório</Button></div>;
}

export function OverviewPage({summary,recentTenants,onClients,onSelect}:{
 summary:Overview|null;recentTenants:TenantPage|null;onClients:()=>void;onSelect:(id:string)=>void
}){return <>

     <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#6885bd]"><span className="size-1.5 rounded-full bg-[#5b7bef]"/> Operação central</div><h1 className="text-3xl font-bold tracking-[-.055em] text-[#17233c] sm:text-[35px]">Visão geral da plataforma</h1><p className="mt-2 text-sm text-[#8190a8]">Acompanhe seus clientes sem acessar os dados privados de cada tenant.</p></div><Button unstyled type="button" onClick={()=>onClients()} className="flex items-center gap-2 rounded-xl bg-[#354fb3] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#273e9e]"><Building2 className="size-4"/> Ver clientes <ArrowRight className="size-4"/></Button></div>
     <div className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5"><Metric icon={Building2} label="Clientes cadastrados" value={summary?.total} hint="Registros no Control Plane" accent="blue"/><Metric icon={CheckCircle2} label="Tenants ativos" value={summary?.active} hint="Com acesso habilitado" accent="green"/><Metric icon={Clock3} label="Aguardando ativação" value={summary?.provisioned} hint="Provisionamento concluído" accent="amber"/><Metric icon={ShieldOff} label="Tenants suspensos" value={summary?.suspended} hint="Acesso operacional suspenso" accent="red"/></div>
     <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(270px,1fr)]">
      <section className="overflow-hidden rounded-[20px] border border-[#e5eaf3] bg-white shadow-sm"><div className="flex items-center justify-between px-6 py-6"><div><h2 className="text-sm font-bold text-[#24314e]">Clientes recentes</h2><p className="mt-1 text-xs text-[#95a2b7]">Últimos registros do diretório central</p></div><Button unstyled type="button" className="flex items-center gap-1 text-xs font-bold text-[#516ec5] hover:text-[#3048a3]" onClick={()=>onClients()}>Ver todos <ArrowRight className="size-3.5"/></Button></div>{!recentTenants?<p role="status" className="px-6 py-8 text-xs text-slate-500">Carregando clientes recentes...</p>:recentTenants.items.length?<TenantTable compact items={recentTenants.items} onSelect={onSelect}/>:<EmptyOverview onClients={()=>onClients()}/>}</section>
      <div className="space-y-5">
       <section className="rounded-[20px] border border-[#e5eaf3] bg-white p-5"><div className="flex items-center gap-2"><UsersRound className="size-4 text-[#617cc6]"/><h3 className="text-xs font-bold text-[#263755]">Membros ativos</h3></div><div className="mt-3 flex items-end gap-2"><strong className="text-[28px] font-bold tracking-tight">{summary?.memberships??"—"}</strong><span className="pb-1.5 text-[11px] text-slate-400">vínculos nos tenants</span></div><p className="mt-2 text-[11px] leading-4 text-slate-400">Vínculos ativos, não necessariamente usuários únicos.</p></section>
      </div>
     </div>

</>;}