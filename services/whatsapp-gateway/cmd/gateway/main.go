package main

import (
 "crypto/subtle"
 "encoding/json"
 "fmt"
 "log"
 "net/http"
 "os"
 "strings"
 "time"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/store"
)

type server struct { db *store.Store; token string }
func reply(w http.ResponseWriter,status int,v any){w.Header().Set("Content-Type","application/json");w.Header().Set("Cache-Control","no-store");w.WriteHeader(status);_ = json.NewEncoder(w).Encode(v)}
func(s *server) auth(next http.HandlerFunc) http.HandlerFunc{
 return func(w http.ResponseWriter,r *http.Request){
  h:=strings.TrimPrefix(r.Header.Get("Authorization"),"Bearer ")
  if s.token=="" || subtle.ConstantTimeCompare([]byte(h),[]byte(s.token))!=1 {reply(w,401,map[string]string{"error":"unauthorized"});return}
  next(w,r)
 }
}
func(s *server) routes()http.Handler{
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /healthz",func(w http.ResponseWriter,r *http.Request){if err:=s.db.DB.PingContext(r.Context());err!=nil{reply(w,503,map[string]string{"status":"error"});return};reply(w,200,map[string]string{"status":"ok"})})
 mux.HandleFunc("GET /",func(w http.ResponseWriter,r *http.Request){w.Header().Set("Content-Type","text/html; charset=utf-8");_,_=w.Write([]byte(dashboard))})
 mux.HandleFunc("GET /api/v1/overview",s.auth(func(w http.ResponseWriter,r *http.Request){
  sessions,err:=s.db.Sessions(r.Context());if err!=nil{reply(w,500,map[string]string{"error":"database"});return}
  links,err:=s.db.Links(r.Context());if err!=nil{reply(w,500,map[string]string{"error":"database"});return}
  tenants:=map[string]bool{};for _,l:=range links{tenants[l.TenantID]=true}
  reply(w,200,map[string]any{"sessions":sessions,"links":links,"totals":map[string]int{"sessions":len(sessions),"links":len(links),"tenants":len(tenants)}})
 }))
 mux.HandleFunc("POST /api/v1/sessions",s.auth(func(w http.ResponseWriter,r *http.Request){
  var v struct{ID string `json:"id"`}
  if json.NewDecoder(http.MaxBytesReader(w,r.Body,4096)).Decode(&v)!=nil || !valid(v.ID){reply(w,400,map[string]string{"error":"invalid id"});return}
  if err:=s.db.AddSession(r.Context(),v.ID);err!=nil{reply(w,409,map[string]string{"error":"session already exists or unavailable"});return}
  reply(w,201,map[string]string{"id":v.ID,"state":"created","provider":"not_connected"})
 }))
 mux.HandleFunc("POST /api/v1/links",s.auth(func(w http.ResponseWriter,r *http.Request){
  var v struct{ SessionID string `json:"session_id"`; TenantID string `json:"tenant_id"`; CanSend bool `json:"can_send"` }
  if json.NewDecoder(http.MaxBytesReader(w,r.Body,4096)).Decode(&v)!=nil || !valid(v.SessionID)||!valid(v.TenantID){reply(w,400,map[string]string{"error":"invalid link"});return}
  if err:=s.db.Link(r.Context(),v.SessionID,v.TenantID,v.CanSend);err!=nil{reply(w,409,map[string]string{"error":"unknown session"});return}
  reply(w,200,map[string]bool{"ok":true})
 }))
 mux.HandleFunc("DELETE /api/v1/links/{session}/{tenant}",s.auth(func(w http.ResponseWriter,r *http.Request){
  if err:=s.db.RemoveLink(r.Context(),r.PathValue("session"),r.PathValue("tenant"));err!=nil{reply(w,404,map[string]string{"error":"not found"});return}
  reply(w,200,map[string]bool{"ok":true})
 }))
 mux.HandleFunc("POST /api/v1/authorize/send",s.auth(func(w http.ResponseWriter,r *http.Request){
  var v struct{SessionID string `json:"session_id"`;TenantID string `json:"tenant_id"`}
  if json.NewDecoder(http.MaxBytesReader(w,r.Body,4096)).Decode(&v)!=nil || !valid(v.SessionID)||!valid(v.TenantID){reply(w,400,map[string]string{"error":"invalid request"});return}
  ok,err:=s.db.Allowed(r.Context(),v.SessionID,v.TenantID);if err!=nil{reply(w,500,map[string]string{"error":"database"});return}
  reply(w,200,map[string]bool{"allowed":ok})
 }))
 mux.HandleFunc("POST /mcp",s.auth(func(w http.ResponseWriter,r *http.Request){
  var q struct{JSONRPC string `json:"jsonrpc"`; ID any `json:"id"`; Method string `json:"method"`; Params struct{Name string `json:"name"`} `json:"params"`}
  if json.NewDecoder(http.MaxBytesReader(w,r.Body,8192)).Decode(&q)!=nil{reply(w,400,map[string]string{"error":"bad json"});return}
  result:=any(nil)
  switch q.Method {
  case "initialize":result=map[string]any{"protocolVersion":"2025-03-26","capabilities":map[string]any{"tools":map[string]any{}},"serverInfo":map[string]string{"name":"syndes-whatsapp-gateway","version":"0.1.0"}}
  case "notifications/initialized":w.WriteHeader(202);return
  case "ping":result=map[string]any{}
  case "tools/list":result=map[string]any{"tools":[]any{map[string]any{"name":"gateway_overview","description":"Read aggregate session and tenant associations; requires gateway administrator authorization.","inputSchema":map[string]any{"type":"object","properties":map[string]any{}}}}}
  case "tools/call":
   if q.Params.Name!="gateway_overview"{reply(w,200,map[string]any{"jsonrpc":"2.0","id":q.ID,"error":map[string]any{"code":-32602,"message":"unknown tool"}});return}
   sessions,e:=s.db.Sessions(r.Context());if e!=nil{reply(w,500,map[string]string{"error":"database"});return}
   links,e:=s.db.Links(r.Context());if e!=nil{reply(w,500,map[string]string{"error":"database"});return}
   b,_:=json.Marshal(map[string]any{"sessions":sessions,"links":links})
   result=map[string]any{"content":[]any{map[string]string{"type":"text","text":string(b)}}}
  default:reply(w,200,map[string]any{"jsonrpc":"2.0","id":q.ID,"error":map[string]any{"code":-32601,"message":"method not found"}});return
  }
  reply(w,200,map[string]any{"jsonrpc":"2.0","id":q.ID,"result":result})
 }))
 return mux
}
func valid(x string)bool{if len(x)<1||len(x)>96{return false};for _,c:=range x{if !(c>='a'&&c<='z'||c>='A'&&c<='Z'||c>='0'&&c<='9'||c=='-'||c=='_'){return false}};return true}
func main(){
 token:=os.Getenv("GATEWAY_ADMIN_TOKEN");if len(token)<32{log.Fatal("GATEWAY_ADMIN_TOKEN must be set and at least 32 characters")}
 path:=os.Getenv("GATEWAY_DB");if path==""{path="./gateway.db"}
 db,err:=store.Open(path);if err!=nil{log.Fatal(err)};defer db.Close()
 address:=os.Getenv("GATEWAY_LISTEN");if address==""{address="127.0.0.1:8080"}
 srv:=&http.Server{Addr:address,Handler:(&server{db:db,token:token}).routes(),ReadHeaderTimeout:5*time.Second,ReadTimeout:15*time.Second,WriteTimeout:30*time.Second}
 fmt.Println("Syndes gateway control-plane on "+address+" (whatsmeow transport pending integration)")
 log.Fatal(srv.ListenAndServe())
}

const dashboard = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Syndes Gateway</title><style>
:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif;background:#0d1310;color:#eff5f0}body{margin:0}.layout{display:grid;grid-template-columns:220px 1fr;min-height:100vh}aside{background:#111b15;border-right:1px solid #29382e;padding:24px}aside h2{color:#8bdb9d}main{padding:30px;max-width:1240px}h1{margin:0}.sub{color:#9eafa4}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:30px 0}.stat,.panel{background:#162119;border:1px solid #2b4131;border-radius:12px;padding:20px}.stat strong{display:block;font-size:34px;margin:10px 0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:14px;border-bottom:1px solid #2b4131;font-size:14px}th{color:#b3c4b8}input,button{background:#223428;color:#eff5f0;border:1px solid #476b50;border-radius:7px;padding:10px}button{cursor:pointer;background:#285f36}.status{color:#f4c876}#error{color:#f28b88}@media(max-width:750px){.layout{grid-template-columns:1fr}aside{padding:12px}main{padding:16px}section{grid-template-columns:1fr}}</style></head>
<body><div class="layout"><aside><h2>◈ Syndes</h2><p>WhatsApp Gateway</p><p class="sub">Overview · Sessões · Tenants</p></aside><main><h1>Visão geral</h1><p class="sub">Controle operacional de números e vínculos — integração WhatsApp ainda não ativada</p><label>Token administrativo <input type="password" id="token" autocomplete="off" placeholder="Cole o token"></label> <button onclick="load()">Consultar</button><p id="error"></p><section><div class="stat">Sessões<strong id="sessions">—</strong></div><div class="stat">Tenants<strong id="tenants">—</strong></div><div class="stat">Vínculos<strong id="links">—</strong></div></section><div class="panel"><h2>Sessões</h2><table><thead><tr><th>ID</th><th>WhatsApp JID</th><th>Estado</th><th>Tenants vinculados</th></tr></thead><tbody id="rows"><tr><td colspan="4">Autentique-se para consultar</td></tr></tbody></table></div></main></div>
<script>async function load(){const token=document.querySelector('#token').value;document.querySelector('#error').textContent='';try{const res=await fetch('/api/v1/overview',{headers:{Authorization:'Bearer '+token},cache:'no-store'});if(!res.ok)throw Error('Não autorizado ou gateway indisponível');const data=await res.json();for(const key of ['sessions','tenants','links'])document.getElementById(key).textContent=data.totals[key];const rows=document.querySelector('#rows');rows.replaceChildren();for(const s of data.sessions){const tr=document.createElement('tr');for(const val of [s.id,s.jid||'Não pareado',s.state,data.links.filter(l=>l.session_id===s.id).map(l=>l.tenant_id).join(', ')||'—']){const td=document.createElement('td');td.textContent=val;tr.appendChild(td)}rows.appendChild(tr)}if(!data.sessions.length)rows.textContent='Nenhuma sessão cadastrada'}catch(e){document.querySelector('#error').textContent=e.message}}</script></body></html>`
