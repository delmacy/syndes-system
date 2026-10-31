package supervisor

import (
 "context"
 "errors"
 "sync"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/provider"
)

// Supervisor owns exactly one in-process connection per persistent device ID.
// It never exposes provider clients to tenants or browser consumers.
type Supervisor struct {
 mu sync.Mutex
 transport provider.Transport
 active map[string]struct{}
}
var ErrAlreadyRunning=errors.New("device is already managed")
var ErrNotRunning=errors.New("device is not managed")
func New(t provider.Transport)*Supervisor {return &Supervisor{transport:t,active:make(map[string]struct{})}}
func(s *Supervisor) Start(ctx context.Context,id string,sink provider.EventSink)error{
 if id==""{return errors.New("missing device")}
 s.mu.Lock();defer s.mu.Unlock()
 if _,ok:=s.active[id];ok{return ErrAlreadyRunning}
 if err:=s.transport.Start(ctx,id,sink);err!=nil{return err}
 s.active[id]=struct{}{};return nil
}
func(s *Supervisor) Stop(ctx context.Context,id string)error{
 s.mu.Lock();defer s.mu.Unlock()
 if _,ok:=s.active[id];!ok{return ErrNotRunning}
 if err:=s.transport.Stop(ctx,id);err!=nil{return err}
 delete(s.active,id);return nil
}
func(s *Supervisor) Status(ctx context.Context,id string)(provider.SessionStatus,error){
 s.mu.Lock();defer s.mu.Unlock()
 if _,ok:=s.active[id];!ok{return provider.StatusDisconnected,nil}
 return s.transport.Status(ctx,id)
}
func(s *Supervisor) StopAll(ctx context.Context)error{
 s.mu.Lock();defer s.mu.Unlock()
 var failed error
 for id:=range s.active{
  if err:=s.transport.Stop(ctx,id);err!=nil{failed=errors.Join(failed,err);continue}
  delete(s.active,id)
 }
 return failed
}

func(s *Supervisor) Logout(ctx context.Context,id string)error{
 s.mu.Lock();defer s.mu.Unlock()
 if _,ok:=s.active[id];!ok{return ErrNotRunning}
 transport,ok:=s.transport.(interface{Logout(context.Context,string)error})
 if !ok{return errors.New("provider does not support logout")}
 if err:=transport.Logout(ctx,id);err!=nil{return err}
 delete(s.active,id);return nil
}
