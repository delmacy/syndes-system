package auth

import (
 "context"
 "crypto"
 "crypto/rand"
 "crypto/rsa"
 "crypto/sha256"
 "encoding/base64"
 "encoding/json"
 "math/big"
 "net/http"
 "net/http/httptest"
 "testing"
 "time"
)
func TestScopedJWKSValidation(t *testing.T){
 key,err:=rsa.GenerateKey(rand.Reader,2048);if err!=nil{t.Fatal(err)}
 enc:=func(b []byte)string{return base64.RawURLEncoding.EncodeToString(b)}
 pub:=map[string]any{"keys":[]any{map[string]any{
  "kty":"RSA","kid":"key1","alg":"RS256","n":enc(key.N.Bytes()),"e":enc(big.NewInt(int64(key.E)).Bytes()),
 }}}
 server:=httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter,r *http.Request){_ =json.NewEncoder(w).Encode(pub)}));defer server.Close()
 verifier:=&Verifier{Issuer:"https://id.example.test/realms/syndes",Audience:"gateway",JWKSURL:server.URL}
 sign:=func(cl map[string]any)string{
  hb,_:=json.Marshal(map[string]string{"alg":"RS256","kid":"key1"});pb,_:=json.Marshal(cl)
  data:=enc(hb)+"."+enc(pb);digest:=sha256.Sum256([]byte(data))
  sig,e:=rsa.SignPKCS1v15(rand.Reader,key,crypto.SHA256,digest[:]);if e!=nil{t.Fatal(e)}
  return data+"."+enc(sig)
 }
 now:=time.Now().Unix()
 good:=map[string]any{"iss":verifier.Issuer,"aud":[]string{"gateway"},"exp":now+120,"nbf":now-2,"scope":"gateway.admin gateway.read"}
 if err:=verifier.Validate(context.Background(),sign(good),"gateway.admin");err!=nil{t.Fatalf("valid token: %v",err)}
 for name,change:=range map[string]func(map[string]any){
  "wrong issuer":func(m map[string]any){m["iss"]="https://bad.example"},
  "wrong audience":func(m map[string]any){m["aud"]="someone-else"},
  "expired":func(m map[string]any){m["exp"]=now-1},
  "future nbf":func(m map[string]any){m["nbf"]=now+100},
  "wrong scope":func(m map[string]any){m["scope"]="gateway.read"},
 }{
  t.Run(name,func(t *testing.T){claims:=map[string]any{};for k,v:=range good{claims[k]=v};change(claims)
   if err:=verifier.Validate(context.Background(),sign(claims),"gateway.admin");err==nil{t.Fatal("invalid token accepted")}
  })
 }
 if err:=verifier.Validate(context.Background(),sign(good)+"x","gateway.admin");err==nil{t.Fatal("signature tampering accepted")}
}
