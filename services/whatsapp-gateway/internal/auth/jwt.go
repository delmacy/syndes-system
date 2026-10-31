// Package auth verifies scoped Keycloak service JWTs independently of browser sessions.
package auth

import (
 "context"
 "crypto"
 "crypto/rsa"
 "crypto/sha256"
 "encoding/base64"
 "encoding/json"
 "errors"
 "fmt"
 "math/big"
 "net/http"
 "net/url"
 "strings"
 "sync"
 "time"
)

var ErrUnauthorized=errors.New("unauthorized")
type Verifier struct{
 Issuer string
 Audience string
 JWKSURL string
 HTTPClient *http.Client
 mu sync.Mutex
 keys map[string]*rsa.PublicKey
 refreshed time.Time
}
type tokenHeader struct { Alg string `json:"alg"`; Kid string `json:"kid"` }
type claims struct {
 Iss string `json:"iss"`
 Aud json.RawMessage `json:"aud"`
 Exp int64 `json:"exp"`
 Nbf int64 `json:"nbf"`
 Scope string `json:"scope"`
}
type jwks struct{ Keys []struct {
 Kid string `json:"kid"`
 Kty string `json:"kty"`
 Alg string `json:"alg"`
 N string `json:"n"`
 E string `json:"e"`
} `json:"keys"` }
func (v *Verifier) Validate(ctx context.Context,bearer,requiredScope string)error{
 if v.Issuer==""||v.Audience==""||v.JWKSURL==""{return ErrUnauthorized}
 parts:=strings.Split(bearer,".");if len(parts)!=3{return ErrUnauthorized}
 hb,err:=base64.RawURLEncoding.DecodeString(parts[0]);if err!=nil{return ErrUnauthorized}
 var header tokenHeader;if json.Unmarshal(hb,&header)!=nil||header.Alg!="RS256"||header.Kid==""{return ErrUnauthorized}
 cb,err:=base64.RawURLEncoding.DecodeString(parts[1]);if err!=nil{return ErrUnauthorized}
 var c claims;if json.Unmarshal(cb,&c)!=nil{return ErrUnauthorized}
 now:=time.Now().Unix();if c.Iss!=v.Issuer||c.Exp<=now||c.Nbf>now{return ErrUnauthorized}
 var aud string
 if json.Unmarshal(c.Aud,&aud)==nil{if aud!=v.Audience{return ErrUnauthorized}}else{
  var arr []string;if json.Unmarshal(c.Aud,&arr)!=nil{return ErrUnauthorized}
  found:=false;for _,x:=range arr{if x==v.Audience{found=true}};if !found{return ErrUnauthorized}
 }
 scopes:=" "+c.Scope+" ";if requiredScope!=""&&!strings.Contains(scopes," "+requiredScope+" "){return ErrUnauthorized}
 key,err:=v.key(ctx,header.Kid);if err!=nil{return ErrUnauthorized}
 sig,err:=base64.RawURLEncoding.DecodeString(parts[2]);if err!=nil{return ErrUnauthorized}
 signed:=[]byte(parts[0]+"."+parts[1]);digest:=sha256.Sum256(signed)
 if rsa.VerifyPKCS1v15(key,crypto.SHA256,digest[:],sig)!=nil{return ErrUnauthorized}
 return nil
}
func(v *Verifier)key(ctx context.Context,kid string)(*rsa.PublicKey,error){
 v.mu.Lock();defer v.mu.Unlock()
 if time.Since(v.refreshed)>5*time.Minute||v.keys[kid]==nil{
  if err:=v.refresh(ctx);err!=nil{return nil,err}
 }
 k:=v.keys[kid];if k==nil{return nil,ErrUnauthorized};return k,nil
}
func(v *Verifier)refresh(ctx context.Context)error{
 u,err:=url.Parse(v.JWKSURL);if err!=nil||u.Scheme!="https"&&!(u.Scheme=="http"&&(u.Hostname()=="127.0.0.1"||u.Hostname()=="localhost")){return ErrUnauthorized}
 req,err:=http.NewRequestWithContext(ctx,http.MethodGet,v.JWKSURL,nil);if err!=nil{return err}
 client:=v.HTTPClient;if client==nil{client=&http.Client{Timeout:5*time.Second}}
 resp,err:=client.Do(req);if err!=nil{return err};defer resp.Body.Close()
 if resp.StatusCode!=200{return fmt.Errorf("jwks HTTP %d",resp.StatusCode)}
 var set jwks;if err=json.NewDecoder(http.MaxBytesReader(nil,resp.Body,262144)).Decode(&set);err!=nil{return err}
 keys:=make(map[string]*rsa.PublicKey)
 for _,j:=range set.Keys{
  if j.Kty!="RSA"||j.Kid==""||j.N==""||j.E==""||j.Alg!=""&&j.Alg!="RS256"{continue}
  nb,e:=base64.RawURLEncoding.DecodeString(j.N);if e!=nil{continue}
  eb,e:=base64.RawURLEncoding.DecodeString(j.E);if e!=nil{continue}
  exp:=new(big.Int).SetBytes(eb);if !exp.IsInt64()||exp.Int64()<3||exp.Int64()>1<<31{continue}
  n:=new(big.Int).SetBytes(nb);if n.BitLen()<2048{continue}
  keys[j.Kid]=&rsa.PublicKey{N:n,E:int(exp.Int64())}
 }
 if len(keys)==0{return ErrUnauthorized}
 v.keys=keys;v.refreshed=time.Now();return nil
}
