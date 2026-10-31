package whatsmeowadapter

import (
 "context"
 "path/filepath"
 "testing"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/store"
)
func TestRecipientValidation(t *testing.T){
 for _,s:=range []string{"","abc","123","+551199999999","5511a999999","@s.whatsapp.net"}{
  if _,err:=recipient(s);err==nil{t.Fatalf("accepted invalid recipient %q",s)}
 }
 for _,s:=range []string{"5511999999999","5511999999999@s.whatsapp.net"}{
  if _,err:=recipient(s);err!=nil{t.Fatalf("rejected recipient %q: %v",s,err)}
 }
}
func TestRealSQLStoreCreatesSeparateSQLiteDatabase(t *testing.T){
 dir:=t.TempDir()
 operational,err:=store.Open(filepath.Join(dir,"gateway.db"));if err!=nil{t.Fatal(err)};defer operational.Close()
 adapter,err:=New(context.Background(),filepath.Join(dir,"sessions.db"),operational.DB)
 if err!=nil{t.Fatal(err)}
 if _,err:=adapter.Status(context.Background(),"missing");err!=nil{t.Fatal(err)}
 if err:=adapter.Close();err!=nil{t.Fatal(err)}
}
