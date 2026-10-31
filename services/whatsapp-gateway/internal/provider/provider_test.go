package provider
import(
 "context"
 "testing"
)
type mock struct{state SessionStatus;sends int}
func(m *mock)Start(context.Context,string,EventSink)error{m.state=StatusConnected;return nil}
func(m *mock)Stop(context.Context,string)error{m.state=StatusDisconnected;return nil}
func(m *mock)Status(context.Context,string)(SessionStatus,error){return m.state,nil}
func(m *mock)Send(_ context.Context,r SendRequest)(SendReceipt,error){if m.state!=StatusConnected{return SendReceipt{},ErrNotConnected};m.sends++;return SendReceipt{ProviderMessageID:r.IdempotencyKey},nil}
type sink struct{}
func(sink)OnMessage(context.Context,Incoming)error{return nil}
func TestReplaceableTransportContract(t *testing.T){
 var p Transport=&mock{};ctx:=context.Background()
 if _,e:=p.Send(ctx,SendRequest{});e!=ErrNotConnected{t.Fatalf("expected disconnected: %v",e)}
 if e:=p.Start(ctx,"a",sink{});e!=nil{t.Fatal(e)}
 status,_:=p.Status(ctx,"a");if status!=StatusConnected{t.Fatal(status)}
 if _,e:=p.Send(ctx,SendRequest{SessionID:"a",IdempotencyKey:"msg-1"});e!=nil{t.Fatal(e)}
 if e:=p.Stop(ctx,"a");e!=nil{t.Fatal(e)}
}
