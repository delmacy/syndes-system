import {Boxes,Info} from "lucide-react";
import type {TenantModuleInventory,TenantModule} from "../../api";

function entitlement(item:TenantModule){
 if(item.entitlementState===null)return "Não concedido";
 if(item.entitlementState==="revoked")return "Revogado";
 if(item.entitlementState==="suspended")return "Suspenso";
 return item.entitled?"Concedido":"Expirado";
}
function installation(item:TenantModule){
 switch(item.installationState){
 case "requested":return "Solicitada";
 case "installed":return "Instalada (registrada)";
 case "enabled":return "Habilitada (registrada)";
 case "suspended":return "Suspensa";
 case "retired":return "Retirada";
 default:return "Não solicitada";
 }
}
export function TenantModulesPanel({inventory,error,loading}:{
 inventory:TenantModuleInventory|null;error:string;loading:boolean;
}){
 return <section aria-label="Módulos do cliente" className="space-y-3">
  <div className="flex items-center gap-2">
   <Boxes className="size-4 text-[#6f84ad]"/>
   <h4 className="text-sm font-bold text-slate-800">Módulos deste cliente</h4>
  </div>
  {loading?<p role="status" className="text-xs text-slate-600">Consultando o catálogo de módulos...</p>:
   error?<p role="alert" className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
     Não foi possível consultar os estados dos módulos neste ambiente. Nenhum estado foi presumido.
    </p>:
   inventory?<div className="space-y-2">
    {inventory.items.length===0?
     <p className="text-xs text-slate-600">O catálogo não contém módulos cadastrados.</p>:
     inventory.items.map(item=><div key={item.moduleId}
       className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
       <span className="text-sm font-semibold text-slate-800">{item.moduleId}</span>
       <span className="text-[11px] text-slate-500">
        {item.approvedVersions.length?item.approvedVersions.join(", "):"Sem versão aprovada"}
       </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
       <div><dt className="text-slate-500">Direito de uso</dt>
        <dd className="font-medium text-slate-700">{entitlement(item)}</dd></div>
       <div><dt className="text-slate-500">Instalação</dt>
        <dd className="font-medium text-slate-700">{installation(item)}</dd></div>
       <div className="col-span-2"><dt className="text-slate-500">Versão instalada registrada</dt>
        <dd className="font-medium text-slate-700">{item.installedVersion??"—"}</dd></div>
      </dl>
     </div>)}
    <div className="flex gap-2 rounded-lg bg-slate-50 p-3 text-[11px] text-slate-500">
     <Info className="mt-0.5 size-4 shrink-0"/>
     <p>Estes são registros administrativos. A execução exige autorização e
      verificação independente do banco do cliente. Nenhuma operação está disponível neste painel.</p>
    </div>
   </div>:<p role="status" className="text-xs text-slate-600">Estado dos módulos não consultado.</p>}
 </section>;
}
