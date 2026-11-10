import {ArrowRight,Search} from "lucide-react";
import {Button} from "@syndes/front-shared";
import type {Tenant} from "../../api";
import {ClientName,Status,formatDate} from "./tenant-presentation";
export function TenantTable({items,onSelect,compact=false}:{items:Tenant[];onSelect:(id:string)=>void;compact?:boolean}){
 if(!items.length)return <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center">
  <div className="rounded-2xl bg-slate-100 p-4 text-slate-400"><Search className="size-6"/></div>
  <h3 className="text-sm font-semibold text-slate-700">Nenhum cliente encontrado</h3>
  <p className="max-w-sm text-xs leading-5 text-slate-500">Ajuste a pesquisa ou aguarde o primeiro tenant registrado no Control Plane.</p>
 </div>;
 return <div className="overflow-x-auto scrollbar-thin">
  <table className="w-full min-w-[620px] text-left">
   <thead><tr className="border-b border-[#edf0f7] bg-[#fafbfe] text-[10px] font-semibold uppercase tracking-[.12em] text-[#8794aa]">
    <th className="px-6 py-4">Cliente</th><th className="px-5 py-4">Situação</th>
    <th className="px-5 py-4">Usuários ativos</th><th className="px-5 py-4">Criado em</th><th className="px-5 py-4 text-right">Abrir</th>
   </tr></thead>
   <tbody>{items.slice(0,compact?5:undefined).map(item=><tr key={item.id} className="group border-b border-[#eef1f6] last:border-b-0 hover:bg-[#f8faff]">
    <td className="px-6 py-4"><ClientName tenant={item}/></td>
    <td className="px-5 py-4"><Status value={item.status}/></td>
    <td className="px-5 py-4 text-sm font-semibold tabular-nums text-slate-700">{item.activeMembers}</td>
    <td className="px-5 py-4 text-[12px] text-slate-500">{formatDate(item.createdAt)}</td>
    <td className="px-5 py-4 text-right"><Button unstyled type="button" onClick={()=>onSelect(item.id)} aria-label={"Detalhes do cliente "+item.id} className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"><ArrowRight className="size-4"/></Button></td>
   </tr>)}</tbody>
  </table>
 </div>;
}
