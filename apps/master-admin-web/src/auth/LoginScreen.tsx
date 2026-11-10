import {ArrowRight,KeyRound,Layers3,Lock,ShieldCheck} from "lucide-react";
import {Button} from "@syndes/front-shared";
import type {MasterConfig} from "../auth";
export function LoginScreen({booting,config,authError,onLogin}:{
 booting:boolean;config:MasterConfig|null;authError:string;onLogin:(config:MasterConfig)=>void
}){
return <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-[#101a31] p-5">
  <div className="pointer-events-none absolute -top-32 right-[-10%] size-[650px] rounded-full bg-[#3345a2]/20 blur-[115px]"/>
  <div className="pointer-events-none absolute -bottom-48 left-[-15%] size-[600px] rounded-full bg-[#1f66aa]/15 blur-[110px]"/>
  <div className="relative z-10 w-full max-w-[440px] rounded-[28px] border border-white/10 bg-white p-9 shadow-[0_35px_110px_rgba(0,0,0,.25)] sm:p-11">
   <div className="mb-9 flex items-center gap-3"><div className="flex size-11 items-center justify-center rounded-xl bg-[#3d5dd1] text-white"><Layers3 className="size-6"/></div><div className="text-2xl font-extrabold tracking-tight text-[#202d4c]">syndes<span className="text-[#506fe0]">.</span><span className="ml-2 align-middle text-[10px] font-bold uppercase tracking-[.17em] text-[#8492a9]">Platform Manager</span></div></div>
   <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#ecf1ff] px-3 py-1.5 text-[11px] font-semibold text-[#4464bd]"><Lock className="size-3.5"/> Acesso reservado à plataforma</div>
   <h1 className="text-3xl font-bold tracking-tight text-[#1e2c4a]">Seu centro de comando.</h1>
   <p className="mt-3 text-sm leading-6 text-[#70809a]">Gerencie a operação do Syndes em um ambiente separado do espaço dos seus clientes.</p>
   {authError&&<div role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-700">{authError}</div>}
   <Button unstyled type="button" disabled={booting||!config} onClick={()=>config&&onLogin(config)}
    className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3c5bcb] py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-[#304fc0] disabled:opacity-50">
    <KeyRound className="size-4"/>{booting?"Carregando autenticação…":"Entrar com Keycloak"}<ArrowRight className="size-4"/>
   </Button>
   <p className="mt-7 flex items-center justify-center gap-1.5 text-[11px] text-[#91a0b7]"><ShieldCheck className="size-3.5"/> O acesso depende de uma autorização específica do operador</p>
  </div>
 </div>;

}