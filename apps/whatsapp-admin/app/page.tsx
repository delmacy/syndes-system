import { auth } from "../auth";
import { redirect } from "next/navigation";
type Session={id:string;jid:string;state:string;created:string};
type Link={session_id:string;tenant_id:string;can_send:boolean};
type Overview={sessions:Session[];links:Link[];totals:{sessions:number;links:number;tenants:number;routes:number;queued:number;processing:number;sent:number;inbound:number}};
async function overview():Promise<Overview|null>{
 const endpoint=process.env.GATEWAY_INTERNAL_URL;const token=process.env.GATEWAY_ADMIN_TOKEN;
 if(!endpoint||!token)return null;
 try{
  const r=await fetch(new URL("/api/v1/overview",endpoint),{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(5000)});
  if(!r.ok)return null;return await r.json() as Overview;
 }catch{return null}
}
export default async function Page(){
 const session=await auth();
 if(!session?.user) redirect("/api/auth/signin");
 // Bootstrap UI only. Must be behind trusted identity-aware access proxy;
 // replace with Keycloak OIDC session + server-side permission checks before production.
 const data=await overview();
 const stats=data?.totals;
 return <div className="layout"><aside><h2>◈ Syndes</h2><p>WhatsApp Admin</p><small>Gateway · Sessões · Tenants</small></aside>
 <main><div className="header"><div><h1>Gateway WhatsApp</h1><p>Visão operacional — protótipo protegido por rede privada</p></div><span>Admin</span></div>
 <section className="stats"><article><small>Sessões</small><strong>{stats?.sessions ?? "—"}</strong></article><article><small>Tenants</small><strong>{stats?.tenants ?? "—"}</strong></article><article><small>Vínculos</small><strong>{stats?.links ?? "—"}</strong></article><article><small>Conversas atribuídas</small><strong>{stats?.routes ?? "—"}</strong></article><article><small>Mensagens em fila</small><strong>{stats?.queued ?? "—"}</strong></article><article><small>Envios confirmados pelo servidor</small><strong>{stats?.sent ?? "—"}</strong></article><article><small>Eventos recebidos</small><strong>{stats?.inbound ?? "—"}</strong></article></section>
 <div className="panel"><h2>Sessões cadastradas</h2><table><thead><tr><th>Dispositivo</th><th>JID</th><th>Estado</th><th>Tenants vinculados</th></tr></thead><tbody>{data?.sessions?.map(s=><tr key={s.id}><td>{s.id}</td><td>{s.jid||"Não pareado"}</td><td>{s.state}</td><td>{data.links.filter(l=>l.session_id===s.id).map(l=>l.tenant_id).join(", ")||"—"}</td></tr>)}{(!data||data.sessions.length===0)&&<tr><td colSpan={4}>{data?"Nenhuma sessão":"Gateway indisponível ou não configurado"}</td></tr>}</tbody></table></div>
 <p className="note">Ainda não há conexão real com WhatsApp, QR ou autorização Keycloak. Não expor publicamente.</p>
 </main></div>
}
