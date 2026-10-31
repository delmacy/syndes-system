package main

import (
 "bytes"
 "context"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/outbox"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/inbox"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "path/filepath"
 "testing"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/store"
)
func TestAuthTenantLinkAndMCP(t *testing.T){
 db,err:=store.Open(filepath.Join(t.TempDir(),"gateway.db"));if err!=nil{t.Fatal(err)};defer db.Close()
 srv:=&server{db:db,token:"an-extra-long-test-token-1234567890"}
 handler:=srv.routes()
 if err:=(outbox.Outbox{DB:db.DB}).Init(context.Background());err!=nil{t.Fatal(err)}
 if err:=(inbox.Store{DB:db.DB}).Init(context.Background());err!=nil{t.Fatal(err)}
 request:=func(method,path,token,body string)*httptest.ResponseRecorder{
  t.Helper();r:=httptest.NewRequest(method,path,bytes.NewBufferString(body));if token!=""{r.Header.Set("Authorization","Bearer "+token)}
  w:=httptest.NewRecorder();handler.ServeHTTP(w,r);return w
 }
 if w:=request("GET","/api/v1/overview","","");w.Code!=401{t.Fatalf("unauthed status %d",w.Code)}
 tok:=srv.token
 if w:=request("POST","/api/v1/sessions",tok,`{"id":"device-1"}`);w.Code!=201{t.Fatalf("create: %d %s",w.Code,w.Body.String())}
 if w:=request("POST","/api/v1/links",tok,`{"session_id":"device-1","tenant_id":"a","can_send":true}`);w.Code!=200{t.Fatalf("link: %d %s",w.Code,w.Body.String())}
 for _,tc:=range []struct{tenant string;allowed bool}{{"a",true},{"b",false}}{
  w:=request("POST","/api/v1/authorize/send",tok,`{"session_id":"device-1","tenant_id":"`+tc.tenant+`"}`)
  var payload struct{Allowed bool `json:"allowed"`};if json.Unmarshal(w.Body.Bytes(),&payload)!=nil||payload.Allowed!=tc.allowed{t.Fatalf("isolation %s: %s",tc.tenant,w.Body.String())}
 }
 if w:=request("POST","/mcp",tok,`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`);w.Code!=200||!bytes.Contains(w.Body.Bytes(),[]byte("gateway_overview")){t.Fatalf("mcp %d: %s",w.Code,w.Body.String())}
 if w:=request("GET","/api/v1/overview",tok,"");w.Code!=200{t.Fatalf("overview: %d",w.Code)}
 if e:=(outbox.Outbox{DB:db.DB}).Assign(context.Background(),outbox.Route{SessionID:"device-1",ChatID:"551199999999",TenantID:"a"});e!=nil{t.Fatal(e)}
 if w:=request("POST","/api/v1/outbox",tok,`{"id":"out-a","session_id":"device-1","tenant_id":"a","recipient":"551199999999","body":"test","priority":1}`);w.Code!=202{t.Fatalf("queue: %d %s",w.Code,w.Body.String())}
 if w:=request("POST","/api/v1/outbox",tok,`{"id":"out-b","session_id":"device-1","tenant_id":"b","recipient":"551199999999","body":"test","priority":1}`);w.Code!=403{t.Fatalf("cross tenant: %d %s",w.Code,w.Body.String())}
 if w:=request("GET","/","","");w.Code!=404{t.Fatalf("embedded frontend still exposed: %d",w.Code)}
 if w:=request("DELETE","/api/v1/links/device-1/a",tok,"");w.Code!=200{t.Fatalf("unlink: %d",w.Code)}
}
func TestIDValidation(t *testing.T){
 for _,s:=range []string{"","bad/id","invalid space",string(make([]byte,97))}{if valid(s){t.Fatalf("accepted invalid id %q",s)}}
 for _,s:=range []string{"tenant-1","dev_2","A123"}{if !valid(s){t.Fatalf("rejected valid id %q",s)}}
}
var _ = http.MethodGet
