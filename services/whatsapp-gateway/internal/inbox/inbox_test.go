package inbox

import(
 "context"
 "path/filepath"
 "testing"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/store"
)
func TestInboundIdempotencyAndDurability(t *testing.T){
 ctx:=context.Background();p:=filepath.Join(t.TempDir(),"gateway.db")
 db,err:=store.Open(p);if err!=nil{t.Fatal(err)}
 in:=Store{DB:db.DB};if err=in.Init(ctx);err!=nil{t.Fatal(err)}
 e:=Event{SessionID:"device",MessageID:"msg-1",ChatID:"chat",SenderID:"person",Kind:"text",Payload:"hello"}
 if _,err=in.Insert(ctx,e);err==nil{t.Fatal("unknown session should violate FK")}
 if err=db.AddSession(ctx,"device");err!=nil{t.Fatal(err)}
 for i:=0;i<2;i++{
  inserted,err:=in.Insert(ctx,e);if err!=nil{t.Fatal(err)}
  if inserted!=(i==0){t.Fatalf("duplicate accepted: iteration %d",i)}
 }
 if err=db.Close();err!=nil{t.Fatal(err)}
 db,err=store.Open(p);if err!=nil{t.Fatal(err)};defer db.Close()
 var n int;if err=db.DB.QueryRowContext(ctx,"SELECT count(*) FROM inbound_events").Scan(&n);err!=nil||n!=1{t.Fatalf("lost or duplicated event: n=%d err=%v",n,err)}
}
