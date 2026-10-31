package main

import (
 "context"
 "errors"
 "os/signal"
 "syscall"
 "crypto/subtle"
 "encoding/json"
 "fmt"
 "log"
 "net/http"
 "os"
 "strings"
 "time"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/store"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/outbox"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/inbox"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/provider"
 whatsmeowadapter "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/provider/whatsmeow"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/supervisor"
)

type server struct { db *store.Store; token string; wa *whatsmeowadapter.Adapter; supervisor *supervisor.Supervisor }
type inboundSink struct{ store inbox.Store }
func(s inboundSink)OnMessage(ctx context.Context,e provider.Incoming)error{
 _,err:=s.store.Insert(ctx,inbox.Event{
  SessionID:e.SessionID,MessageID:e.MessageID,ChatID:e.ChatID,SenderID:e.SenderID,Kind:"message",Payload:e.Text,
 })
 return err
}

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
 mux.HandleFunc("POST /api/v1/sessions/{id}/connect",s.auth(func(w http.ResponseWriter,r *http.Request){
  id:=r.PathValue("id");if !valid(id){reply(w,400,map[string]string{"error":"invalid id"});return}
  err:=s.supervisor.Start(r.Context(),id,inboundSink{store:inbox.Store{DB:s.db.DB}})
  if err!=nil{reply(w,409,map[string]string{"error":err.Error()});return}
  reply(w,202,map[string]string{"status":"connecting"})
 }))
 mux.HandleFunc("POST /api/v1/sessions/{id}/disconnect",s.auth(func(w http.ResponseWriter,r *http.Request){
  id:=r.PathValue("id");if !valid(id){reply(w,400,map[string]string{"error":"invalid id"});return}
  if err:=s.supervisor.Stop(r.Context(),id);err!=nil{reply(w,409,map[string]string{"error":err.Error()});return}
  reply(w,200,map[string]string{"status":"disconnected"})
 }))
 mux.HandleFunc("GET /api/v1/sessions/{id}/status",s.auth(func(w http.ResponseWriter,r *http.Request){
  id:=r.PathValue("id");if !valid(id){reply(w,400,map[string]string{"error":"invalid id"});return}
  status,err:=s.supervisor.Status(r.Context(),id);if err!=nil{reply(w,500,map[string]string{"error":"status unavailable"});return}
  reply(w,200,map[string]any{"session_id":id,"status":status})
 }))
 mux.HandleFunc("GET /api/v1/sessions/{id}/qr",s.auth(func(w http.ResponseWriter,r *http.Request){
  id:=r.PathValue("id");if !valid(id){reply(w,400,map[string]string{"error":"invalid id"});return}
  code,ok:=s.wa.QR(id);if !ok{reply(w,404,map[string]string{"error":"no active QR; connect the session first"});return}
  reply(w,200,map[string]string{"code":code})
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
 mux.HandleFunc("POST /api/v1/outbox",s.auth(func(w http.ResponseWriter,r *http.Request){
  var j outbox.Job
  if json.NewDecoder(http.MaxBytesReader(w,r.Body,70000)).Decode(&j)!=nil || !valid(j.ID)||!valid(j.SessionID)||!valid(j.TenantID){reply(w,400,map[string]string{"error":"invalid message"});return}
  // An operator token is a temporary bootstrap mechanism; this endpoint only queues,
  // never sends. Keycloak subject and conversation authorization are required for production.
  e:=(outbox.Outbox{DB:s.db.DB}).Enqueue(r.Context(),j)
  if e==outbox.ErrUnauthorized{reply(w,403,map[string]string{"error":"forbidden"});return}
  if e!=nil{reply(w,400,map[string]string{"error":"enqueue failed"});return}
  reply(w,202,map[string]string{"status":"queued","id":j.ID})
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
 ctx,cancel:=signal.NotifyContext(context.Background(),syscall.SIGINT,syscall.SIGTERM);defer cancel()
 if err=(outbox.Outbox{DB:db.DB}).Init(ctx);err!=nil{log.Fatal(err)}
 incoming:=inbox.Store{DB:db.DB};if err=incoming.Init(ctx);err!=nil{log.Fatal(err)}
 sessionPath:=os.Getenv("WHATSAPP_SESSIONS_DB");if sessionPath==""{sessionPath="./sessions.db"}
 adapter,err:=whatsmeowadapter.New(ctx,sessionPath,db.DB);if err!=nil{log.Fatal(err)};defer adapter.Close()
 manager:=supervisor.New(adapter)
 svc:=&server{db:db,token:token,wa:adapter,supervisor:manager}
 sessions,err:=db.Sessions(ctx)
 if err!=nil{log.Fatal(err)}
 for _,session:=range sessions{
  if session.JID==""{continue}
  if err:=manager.Start(ctx,session.ID,inboundSink{store:incoming});err!=nil{log.Printf("session %s: failed to reconnect: %v",session.ID,err)}
 }
 go dispatch(ctx,db,adapter)
 address:=os.Getenv("GATEWAY_LISTEN");if address==""{address="127.0.0.1:8080"}
 srv:=&http.Server{Addr:address,Handler:svc.routes(),ReadHeaderTimeout:5*time.Second,ReadTimeout:15*time.Second,WriteTimeout:30*time.Second}
 go func(){<-ctx.Done();shutdownCtx,done:=context.WithTimeout(context.Background(),15*time.Second);defer done();_ =srv.Shutdown(shutdownCtx);_ =manager.StopAll(shutdownCtx)}()
 log.Printf("Syndes WhatsApp gateway listening on %s",address)
 if err:=srv.ListenAndServe();err!=nil&&!errors.Is(err,http.ErrServerClosed){log.Fatal(err)}
}
func dispatch(ctx context.Context,db *store.Store,adapter *whatsmeowadapter.Adapter){
 ticker:=time.NewTicker(time.Second);defer ticker.Stop()
 queue:=outbox.Outbox{DB:db.DB}
 for{
  select{case <-ctx.Done():return;case <-ticker.C:}
  sessions,err:=db.Sessions(ctx);if err!=nil{log.Printf("queue list: %v",err);continue}
  for _,s:=range sessions{
   state,e:=adapter.Status(ctx,s.ID);if e!=nil||state!=provider.StatusConnected{continue}
   job,e:=queue.Claim(ctx,s.ID,time.Now());if e!=nil{log.Printf("queue claim: %v",e);continue};if job==nil{continue}
   sendCtx,cancel:=context.WithTimeout(ctx,20*time.Second)
   _,sendErr:=adapter.Send(sendCtx,provider.SendRequest{SessionID:job.SessionID,Recipient:job.Recipient,Text:job.Body,IdempotencyKey:job.ID})
   cancel()
   if err:=queue.Complete(ctx,job.ID,sendErr==nil);err!=nil{log.Printf("queue complete: %v",err)}
   if sendErr!=nil{log.Printf("outbound delivery failed for job %s: %v",job.ID,sendErr)}
  }
 }
}
