import {useEffect,useState} from "react";
import {Building2,Check,Clock3,Copy,Database,UsersRound,X} from "lucide-react";
import {Button} from "@syndes/front-shared";
import {MasterApi,type Tenant,type TenantModuleInventory} from "../../api";
import {Status,formatDate} from "./tenant-presentation";
import {TenantModulesPanel} from "./TenantModulesPanel";
export function ClientDrawer({tenantId,api,onClose}:{tenantId:string;api:MasterApi;onClose:()=>void}){
 const [copied,setCopied]=useState(false);
 const [tenant,setTenant]=useState<Tenant|null>(null);
 const [error,setError]=useState("");
 const [moduleInventory,setModuleInventory]=useState<TenantModuleInventory|null>(null);
 const [moduleError,setModuleError]=useState("");
 const [moduleLoading,setModuleLoading]=useState(true);
 useEffect(()=>{
  let active=true;const controller=new AbortController();
  void api.tenant(tenantId,controller.signal).then(detail=>{if(active)setTenant(detail)}).catch(reason=>{
   if(active&&!(reason instanceof DOMException&&reason.name==="AbortError"))
    setError(reason instanceof Error?reason.message:"Falha ao consultar detalhes");
  });
  void api.tenantModules(tenantId,controller.signal).then(result=>{
   if(active)setModuleInventory(result);
  }).catch(reason=>{
   if(active&&!(reason instanceof DOMException&&reason.name==="AbortError"))
    setModuleError(reason instanceof Error?reason.message:"Catálogo indisponível");
  }).finally(()=>{if(active)setModuleLoading(false)});
  return()=>{active=false;controller.abort()};
 },[api,tenantId]);
 return <div className="fixed inset-0 z-[60] flex justify-end bg-[#101a32]/40 backdrop-blur-[2px]" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
  <section role="dialog" aria-modal="true" aria-label="Detalhes do cliente" className="animate-enter flex h-full w-full max-w-[490px] flex-col bg-white shadow-2xl">
   <div className="flex items-center justify-between border-b border-slate-100 px-7 py-6">
    <div><span className="text-[10px] font-bold uppercase tracking-[.18em] text-[#8998ae]">Control Plane</span><h2 className="mt-1 text-lg font-bold text-[#17233e]">Detalhes do cliente</h2></div>
    <Button unstyled type="button" onClick={onClose} aria-label="Fechar detalhes" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="size-5"/></Button>
   </div>
   <div className="flex-1 space-y-7 overflow-y-auto px-7 py-7">{tenant ? <>
    <div className="flex items-center gap-4"><div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Building2 className="size-6"/></div><div className="min-w-0"><h3 className="truncate text-base font-bold text-slate-800">{tenant.displayName??"Cliente sem nome cadastrado"}</h3><div className="mt-2"><Status value={tenant.status}/></div></div></div>
    <div className="rounded-2xl border border-[#e5eaf3] bg-[#f9fbff] p-5">
     <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Identificador técnico do tenant</p>
     <div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-slate-700">{tenant.id}</code><Button unstyled type="button" className="rounded-lg p-2 text-slate-500 hover:bg-white" title="Copiar ID" onClick={()=>void navigator.clipboard.writeText(tenant.id).then(()=>setCopied(true))}>{copied?<Check className="size-4 text-emerald-600"/>:<Copy className="size-4"/>}</Button></div>
    </div>
    <div className="grid grid-cols-2 gap-3">
     <div className="rounded-xl border border-slate-100 p-4"><UsersRound className="size-4 text-[#6f84ad]"/><p className="mt-3 text-2xl font-bold text-[#263856]">{tenant.activeMembers}</p><p className="mt-1 text-xs text-slate-500">Membros ativos</p></div>
     <div className="rounded-xl border border-slate-100 p-4"><Clock3 className="size-4 text-[#6f84ad]"/><p className="mt-3 text-[13px] font-bold text-[#263856]">{formatDate(tenant.createdAt)}</p><p className="mt-1 text-xs text-slate-500">Data de criação</p></div>
    </div>
    <TenantModulesPanel inventory={moduleInventory} error={moduleError} loading={moduleLoading}/>
    <div className="space-y-4"><h4 className="text-sm font-bold text-slate-800">Limites administrativos</h4>
     <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4"><Database className="mt-0.5 size-5 shrink-0 text-blue-600"/><p className="text-xs leading-5 text-[#4d6691]">Este painel consulta apenas o cadastro central. Ele não lê o banco exclusivo do cliente, seus contatos, conversas ou credenciais.</p></div>
     <p className="text-xs leading-5 text-slate-500">Concessões, instalação de módulos e suspensão continuam indisponíveis até a integração dos comandos administrativos autenticados e auditados.</p>
    </div>
   </> : error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : <p role="status" className="text-sm text-slate-600">Carregando detalhes...</p>}</div>
   <div className="border-t border-slate-100 px-7 py-5"><Button unstyled type="button" onClick={onClose} className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Voltar ao diretório</Button></div>
  </section>
 </div>;
}
