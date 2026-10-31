package outbox

import (
 "context"
 "errors"
 "fmt"
 "path/filepath"
 "testing"
 "time"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/store"
)
func TestIsolationIdempotencyLimitsAndRecovery(t *testing.T){
 ctx:=context.Background();path:=filepath.Join(t.TempDir(),"db.sqlite")
 s,e:=store.Open(path);if e!=nil{t.Fatal(e)};defer s.Close()
 q:=Outbox{DB:s.DB};if e=q.Init(ctx);e!=nil{t.Fatal(e)}
 if e=s.AddSession(ctx,"session");e!=nil{t.Fatal(e)}
 if e=s.Link(ctx,"session","tenant-a",true);e!=nil{t.Fatal(e)}
 unauthorized:=Job{ID:"wrong",SessionID:"session",TenantID:"tenant-b",Recipient:"123",Body:"hello",Priority:0}
 if e=q.Enqueue(ctx,unauthorized);!errors.Is(e,ErrUnauthorized){t.Fatalf("cross tenant accepted: %v",e)}
 if e=q.Assign(ctx,Route{SessionID:"session",ChatID:"123",TenantID:"tenant-a"});e!=nil{t.Fatal(e)}
 for i:=0;i<50;i++{j:=Job{ID:fmt.Sprintf("job-%d",i),SessionID:"session",TenantID:"tenant-a",Recipient:"123",Body:"hello",Priority:1};if e=q.Enqueue(ctx,j);e!=nil{t.Fatal(e)}}
 if e=q.Enqueue(ctx,Job{ID:"job-0",SessionID:"session",TenantID:"tenant-a",Recipient:"123",Body:"hello",Priority:1});e!=nil{t.Fatal(e)}
 now:=time.Now().UTC()
 for i:=0;i<40;i++{j,e:=q.Claim(ctx,"session",now);if e!=nil||j==nil{t.Fatalf("expected job %d: %v",i,e)}}
 j,e:=q.Claim(ctx,"session",now);if e!=nil||j!=nil{t.Fatalf("rate limit bypass: %+v %v",j,e)}
 next:=now.Add(time.Minute*2)
 j,e=q.Claim(ctx,"session",next);if e!=nil||j==nil{t.Fatalf("new window failed: %v",e)}
 // queued messages must become unavailable immediately after link revocation
 if e=s.RemoveLink(ctx,"session","tenant-a");e!=nil{t.Fatal(e)}
 j,e=q.Claim(ctx,"session",next.Add(time.Minute));if e!=nil||j!=nil{t.Fatalf("revoked tenant dispatched: %v",e)}
 // WAL durability after reopen
 if e=s.Close();e!=nil{t.Fatal(e)}
 s2,e:=store.Open(path);if e!=nil{t.Fatal(e)};defer s2.Close()
 var n int;if e=s2.DB.QueryRowContext(ctx,"SELECT count(*) FROM outbox").Scan(&n);e!=nil||n!=50{t.Fatalf("data lost: %v count=%d",e,n)}
}
