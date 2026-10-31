package supervisor

import (
 "context"
 "errors"
 "testing"
 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/provider"
)
type fake struct{starts,stops int;failStart,failStop bool}
func(f *fake)Start(context.Context,string,provider.EventSink)error{if f.failStart{return errors.New("connect failed")};f.starts++;return nil}
func(f *fake)Stop(context.Context,string)error{if f.failStop{return errors.New("disconnect failed")};f.stops++;return nil}
func(f *fake)Status(context.Context,string)(provider.SessionStatus,error){return provider.StatusConnected,nil}
func(f *fake)Send(context.Context,provider.SendRequest)(provider.SendReceipt,error){return provider.SendReceipt{},nil}
type sink struct{}
func(sink)OnMessage(context.Context,provider.Incoming)error{return nil}
func TestSingleOwnerAndShutdown(t *testing.T){
 ctx:=context.Background();f:=&fake{};s:=New(f)
 if e:=s.Start(ctx,"one",sink{});e!=nil{t.Fatal(e)}
 if e:=s.Start(ctx,"one",sink{});!errors.Is(e,ErrAlreadyRunning){t.Fatal("duplicate device connection accepted")}
 if e:=s.Start(ctx,"two",sink{});e!=nil{t.Fatal(e)}
 if f.starts!=2{t.Fatal("incorrect connection count")}
 if e:=s.StopAll(ctx);e!=nil{t.Fatal(e)}
 if f.stops!=2{t.Fatal("connections leaked")}
 status,_:=s.Status(ctx,"one");if status!=provider.StatusDisconnected{t.Fatal(status)}
}
func TestFailedConnectAndStopAreRecoverable(t *testing.T){
 ctx:=context.Background();f:=&fake{failStart:true};s:=New(f)
 if s.Start(ctx,"one",sink{})==nil{t.Fatal("failure ignored")}
 f.failStart=false
 if e:=s.Start(ctx,"one",sink{});e!=nil{t.Fatal(e)}
 f.failStop=true
 if s.Stop(ctx,"one")==nil{t.Fatal("stop failure ignored")}
 f.failStop=false
 if e:=s.Stop(ctx,"one");e!=nil{t.Fatal(e)}
}
