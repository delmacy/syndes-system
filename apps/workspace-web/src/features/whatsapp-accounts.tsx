import {useCallback,useEffect,useState} from "react";
import {QRCodeSVG} from "qrcode.react";
import {toast} from "sonner";
import {Button} from "@syndes/front-shared/button";
import {Card,CardContent,CardHeader,CardTitle} from "@syndes/front-shared/card";
import {Input} from "@syndes/front-shared/input";
import type {TenantApi,WhatsAppAccount} from "@/lib/api";

export function WhatsAppAccountsFeature({api}:{api:TenantApi}){
 const [accounts,setAccounts]=useState<WhatsAppAccount[]>([]);
 const [name,setName]=useState("");
 const [pairing,setPairing]=useState<{accountId:string;code:string;expiresAt:string}|null>(null);
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{try{setAccounts(await api.whatsappAccounts())}catch(e){toast.error(e instanceof Error?e.message:"Não foi possível consultar os números")}},[api]);
 useEffect(()=>{void refresh();const handle=window.setInterval(()=>{void refresh()},10000);return()=>window.clearInterval(handle)},[refresh]);
 // Whatsmeow rotates QR codes before the pairing session ends. Refresh
 // proactively; the previous QR is invalid once the provider rotates it.
 useEffect(()=>{
  if(!pairing)return;
  const delay=Math.max(1500,Math.min(60000,Date.parse(pairing.expiresAt)-Date.now()-4000));
  let canceled=false;
  const timer=window.setTimeout(()=>{
   void api.pairWhatsAppAccount(pairing.accountId).then(next=>{
    if(!canceled)setPairing(current=>current?.accountId===pairing.accountId?
     {...current,code:next.pairingCode,expiresAt:next.expiresAt}:current);
   }).catch(()=>{
    if(!canceled){
     setPairing(null);
     void refresh();
     toast.info("Pareamento concluído ou código expirado. Consulte o estado do número.");
    }
   });
  },delay);
  return()=>{canceled=true;window.clearTimeout(timer)};
 },[pairing?.accountId,pairing?.expiresAt,api,refresh]);
 const run=async(action:()=>Promise<unknown>)=>{setBusy(true);try{await action();await refresh()}catch(e){toast.error(e instanceof Error?e.message:"Operação indisponível")}finally{setBusy(false)}};
 return <section className="space-y-6">
  <div><p className="eyebrow">Canais</p><h1 className="page-title">Números WhatsApp</h1><p className="page-subtitle">Gerencie somente os números vinculados à sua organização.</p></div>
  <Card><CardHeader><CardTitle className="text-base">Adicionar número</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Input aria-label="Nome do número" placeholder="Ex.: Atendimento comercial" value={name} onChange={e=>setName(e.target.value)} className="max-w-sm" /><Button disabled={busy||!name.trim()} onClick={()=>void run(async()=>{await api.createWhatsAppAccount(name);setName("");toast.success("Conta criada")})}>Adicionar</Button></CardContent></Card>
  {accounts.map(a=><Card key={a.id}><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6"><div><strong>{a.displayName}</strong><p className="text-sm text-muted-foreground">{a.phoneExternalId??"Ainda não pareado"} · {a.serviceEnabled?a.state:"desativado"}</p></div><div className="flex flex-wrap gap-2"><Button disabled={busy||!a.serviceEnabled} onClick={()=>void run(async()=>{const result=await api.pairWhatsAppAccount(a.id);setPairing({accountId:a.id,code:result.pairingCode,expiresAt:result.expiresAt})})}>Mostrar QR Code</Button><Button variant="outline" disabled={busy||!a.serviceEnabled} onClick={()=>void run(async()=>{await api.connectWhatsAppAccount(a.id);toast.success("Conexão solicitada")})}>Reconectar</Button>{a.serviceEnabled?<><Button variant="outline" disabled={busy} onClick={()=>void run(async()=>{await api.disconnectWhatsAppAccount(a.id);setPairing(null);toast.success("Conexão encerrada")})}>Desconectar</Button><Button variant="destructive" disabled={busy} onClick={()=>void run(async()=>{await api.setWhatsAppEnabled(a.id,false);setPairing(null);toast.success("Número desativado")})}>Desativar</Button></>:<Button variant="outline" disabled={busy} onClick={()=>void run(async()=>{await api.setWhatsAppEnabled(a.id,true);toast.success("Número reativado")})}>Reativar</Button>}</div></CardContent></Card>)}
  {pairing&&<Card><CardHeader><CardTitle>Escaneie com o WhatsApp</CardTitle></CardHeader><CardContent className="space-y-3"><QRCodeSVG value={pairing.code} size={240} bgColor="#ffffff" fgColor="#000000" /><p className="text-sm text-muted-foreground">QR Code temporário; expira em {new Date(pairing.expiresAt).toLocaleTimeString("pt-BR")}.</p><Button variant="outline" disabled={busy} onClick={()=>void run(async()=>{const result=await api.pairWhatsAppAccount(pairing.accountId);setPairing({...pairing,code:result.pairingCode,expiresAt:result.expiresAt})})}>Atualizar código</Button></CardContent></Card>}
 </section>;
}
