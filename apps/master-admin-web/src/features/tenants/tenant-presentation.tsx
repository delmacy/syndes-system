import {Building2} from "lucide-react";
import {Badge} from "@syndes/front-shared";
import type {Tenant} from "../../api";
const statusNames:Record<Tenant["status"],string>={
 active:"Ativo",provisioned:"Provisionado",suspended:"Suspenso"
};
export const formatDate=(value:string)=>new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium"}).format(new Date(value));
export function Status({value}:{value:Tenant["status"]}){
 return <Badge unstyled className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold "+
  (value==="active"?"bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100":
  value==="suspended"?"bg-rose-50 text-rose-700 ring-1 ring-rose-100":
  "bg-amber-50 text-amber-700 ring-1 ring-amber-100")}>
  <span className={"size-1.5 rounded-full "+(value==="active"?"bg-emerald-500":value==="suspended"?"bg-rose-500":"bg-amber-500")}/>
  {statusNames[value]}
 </Badge>;
}
export function ClientName({tenant}:{tenant:Tenant}){
 return <div className="flex min-w-0 items-center gap-3">
   <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600"><Building2 className="size-[18px]"/></div>
   <div className="min-w-0">
    <div className="truncate font-semibold text-slate-800">{tenant.displayName??"Cliente sem nome cadastrado"}</div>
    <div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{tenant.id.slice(0,13)}…</div>
   </div>
 </div>;
}
