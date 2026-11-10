import {useState,type ReactNode} from "react";
import {Building2,Layers3,LayoutDashboard,LogOut,Menu,RefreshCw,Shield,ShieldCheck,ShieldOff} from "lucide-react";
import {Button} from "@syndes/front-shared";
import type {Operator} from "../api";
import type {View} from "./view";
const navigation:{id:View;label:string;icon:typeof LayoutDashboard}[]=[
 {id:"overview",label:"Visão geral",icon:LayoutDashboard},
 {id:"clients",label:"Clientes",icon:Building2},
];
const roleNames:Record<Operator["role"],string>={
 owner:"Proprietário da plataforma",operator:"Operador",viewer:"Consulta"
};

export function ManagerShell({view,onViewChange,onRefresh,onSignOut,operator,previewMode,loadingData,dataError,children}:{
 view:View;onViewChange:(view:View)=>void;onRefresh:()=>void;onSignOut:()=>void;
 operator:Operator;previewMode:boolean;loadingData:boolean;dataError:string;children:ReactNode
}){
 const [mobileNav,setMobileNav]=useState(false);
 const switchView=(next:View)=>{onViewChange(next);setMobileNav(false)};
return <div className="flex min-h-dvh bg-[#f6f8fc] text-[#1b2845]">
  {mobileNav&&<Button unstyled type="button" aria-label="Fechar menu" className="fixed inset-0 z-30 bg-slate-900/45 lg:hidden" onClick={()=>setMobileNav(false)}/>}
  <aside className={"fixed inset-y-0 left-0 z-40 flex w-[254px] flex-col bg-[#111c32] text-white transition-transform lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0 "+(mobileNav?"translate-x-0":"-translate-x-full")}>
   <div className="flex h-[92px] items-center gap-3 px-7"><span className="flex size-10 items-center justify-center rounded-xl bg-[#4667dd] shadow-lg shadow-indigo-900/30"><Layers3 className="size-[22px]"/></span><div><div className="text-xl font-extrabold tracking-[-.055em]">syndes<span className="text-[#7a9cff]">.</span></div><div className="-mt-0.5 text-[9px] font-semibold uppercase tracking-[.22em] text-[#7588b0]">Syndes Platform Manager</div></div></div>
   <div className="px-4"><div className="rounded-[14px] border border-[#34405b]/70 bg-[#1a2944] p-3.5"><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#a0b4d3]"><span className="size-1.5 rounded-full bg-emerald-400"/> Plataforma Syndes</div><p className="mt-1 text-xs text-[#899cbb]">Administração central</p></div></div>
   <nav className="mt-9 flex-1 space-y-1 px-3" aria-label="Navegação do Platform Manager"><div className="mb-3 px-4 text-[10px] font-semibold uppercase tracking-[.19em] text-[#617394]">Gestão da plataforma</div>
    {navigation.map(item=><Button unstyled type="button" key={item.id} onClick={()=>switchView(item.id)} aria-current={view===item.id?"page":undefined} className={"flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition "+(view===item.id?"bg-[#2c4170] text-white shadow-inner":"text-[#91a1bf] hover:bg-white/5 hover:text-white")}>
     <item.icon className={"size-[18px] "+(view===item.id?"text-[#92b1ff]":"text-[#7486a7]")}/><span className="flex-1 text-[13px] font-semibold">{item.label}</span>{view===item.id&&<span className="size-1.5 rounded-full bg-[#86a6ff]"/>}
    </Button>)}
   </nav>
   <div className="border-t border-white/10 px-4 py-4">
    <div className="flex items-center gap-3 rounded-xl px-2 py-2"><div className="flex size-9 items-center justify-center rounded-full bg-[#2a426a] text-xs font-bold text-[#b8caff]"><Shield className="size-4"/></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#e4ecff]">Administrador</p><p className="truncate text-[10px] text-[#8295b6]">{previewMode?"Somente demonstração":roleNames[operator.role]}</p></div><Button unstyled type="button" title="Encerrar sessão local" aria-label="Sair" onClick={onSignOut} className="rounded-lg p-2 text-[#8094ba] hover:bg-white/10 hover:text-white"><LogOut className="size-4"/></Button></div>
   </div>
  </aside>
  <div className="min-w-0 flex-1">
   <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-4 border-b border-[#e5eaf2] bg-white/95 px-5 backdrop-blur lg:px-10">
    <div className="flex min-w-0 items-center gap-3"><Button unstyled type="button" aria-label="Abrir menu" className="rounded-lg p-2 text-slate-600 lg:hidden" onClick={()=>setMobileNav(true)}><Menu className="size-5"/></Button><div className="min-w-0"><p className="truncate text-[11px] text-[#91a0b2]">Syndes / Plataforma</p><h2 className="truncate text-sm font-bold text-[#223151]">{navigation.find(x=>x.id===view)?.label}</h2></div></div>
    <div className="flex items-center gap-3"><Button unstyled type="button" title="Atualizar dados" aria-label="Atualizar dados" className="flex size-9 items-center justify-center rounded-xl border border-[#e2e8f2] text-[#667797] hover:bg-slate-50" onClick={()=>onRefresh()}><RefreshCw className="size-4"/></Button><span className="flex size-9 items-center justify-center rounded-full bg-[#e8edfc] text-[#4865bf]"><ShieldCheck className="size-4"/></span></div>
   </header>
       <main className="mx-auto w-full max-w-[1480px] px-5 pb-14 pt-8 lg:px-10 lg:pt-10">
{previewMode&&<div role="status" data-testid="visual-preview-banner" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-semibold leading-6 text-amber-900">PRÉVIA NAVEGÁVEL — Dados fictícios para avaliação do layout. Nenhuma conta real, API administrativa ou dado de cliente está conectado.</div>}
    {loadingData&&<p role="status" className="mb-4 text-xs text-slate-500">Carregando dados...</p>}
    {dataError&&<div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700"><ShieldOff className="size-4"/><span className="flex-1">{dataError}</span><Button unstyled onClick={()=>onRefresh()} className="font-bold underline">Tentar novamente</Button></div>}
         {children}
<footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#e0e7f0] pt-6 text-[11px] text-[#95a3b8]"><span>© Syndes · Syndes Platform Manager</span><span className="flex items-center gap-1.5"><ShieldCheck className="size-3.5"/> {previewMode?"Simulação local, sem acesso a APIs":"Consultas ao Control Plane"}</span></footer>
       </main>
   </div>
  </div>;
}