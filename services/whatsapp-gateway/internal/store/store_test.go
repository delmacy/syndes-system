package store

import (
 "context"
 "path/filepath"
 "testing"
)
func TestTenantIsolationAndRecovery(t *testing.T) {
 path:=filepath.Join(t.TempDir(),"gateway.db")
 s,err:=Open(path);if err!=nil{t.Fatal(err)}
 ctx:=context.Background()
 if err=s.AddSession(ctx,"device-1");err!=nil{t.Fatal(err)}
 if err=s.Link(ctx,"device-1","tenant-a",true);err!=nil{t.Fatal(err)}
 if err=s.Link(ctx,"device-1","tenant-b",false);err!=nil{t.Fatal(err)}
 for _,tc:=range []struct{tenant string; want bool}{{"tenant-a",true},{"tenant-b",false},{"tenant-c",false}}{
  got,e:=s.Allowed(ctx,"device-1",tc.tenant);if e!=nil||got!=tc.want{t.Fatalf("tenant %s: %v %v",tc.tenant,got,e)}
 }
 if err=s.Close();err!=nil{t.Fatal(err)}
 s,err=Open(path);if err!=nil{t.Fatal(err)};defer s.Close()
 allowed,err:=s.Allowed(ctx,"device-1","tenant-a");if err!=nil||!allowed{t.Fatalf("persistence: %v %v",allowed,err)}
 if err=s.RemoveLink(ctx,"device-1","tenant-a");err!=nil{t.Fatal(err)}
 allowed,err=s.Allowed(ctx,"device-1","tenant-a");if err!=nil||allowed{t.Fatalf("revocation: %v %v",allowed,err)}
}
func TestForeignKeyAndDuplicate(t *testing.T){
 s,e:=Open(filepath.Join(t.TempDir(),"db.sqlite"));if e!=nil{t.Fatal(e)};defer s.Close()
 ctx:=context.Background()
 if s.Link(ctx,"unknown","tenant",true)==nil{t.Fatal("foreign key not enforced")}
 if s.AddSession(ctx,"one")!=nil{t.Fatal("insert failed")}
 if s.AddSession(ctx,"one")==nil{t.Fatal("duplicate accepted")}
}
