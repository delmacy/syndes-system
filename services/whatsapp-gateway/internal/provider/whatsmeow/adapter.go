package whatsmeowadapter

import (
 "context"
 "database/sql"
 "errors"
 "fmt"
 "strings"
 "sync"
 "time"

 "go.mau.fi/whatsmeow"
 waE2E "go.mau.fi/whatsmeow/proto/waE2E"
 "go.mau.fi/whatsmeow/store"
 "go.mau.fi/whatsmeow/store/sqlstore"
 "go.mau.fi/whatsmeow/types"
 "go.mau.fi/whatsmeow/types/events"
 "google.golang.org/protobuf/proto"

 "github.com/delmacy/syndes-system/services/whatsapp-gateway/internal/provider"
)

type device struct {
 client *whatsmeow.Client
 qr string
 qrTime time.Time
}

// Adapter manages whatsmeow transport independently from the Syndes business domain.
// Its SQLStore is separate from gateway.db so upstream schema migrations are isolated.
type Adapter struct {
 mu sync.RWMutex
 storage *sqlstore.Container
 operational *sql.DB
 clients map[string]*device
}

func New(ctx context.Context,sqlitePath string,operational *sql.DB)(*Adapter,error){
 dsn:="file:"+sqlitePath+"?_foreign_keys=on&_busy_timeout=5000&_journal_mode=WAL"
 c,err:=sqlstore.New(ctx,"sqlite3",dsn,nil)
 if err!=nil{return nil,fmt.Errorf("whatsmeow store: %w",err)}
 return &Adapter{storage:c,operational:operational,clients:map[string]*device{}},nil
}
func(a *Adapter)Close()error{
 a.mu.Lock();defer a.mu.Unlock()
 for _,d:=range a.clients{d.client.Disconnect()}
 return a.storage.Close()
}

func(a *Adapter) Start(ctx context.Context,id string,sink provider.EventSink) error{
 a.mu.Lock()
 defer a.mu.Unlock()
 if _,ok:=a.clients[id];ok{return errors.New("session already connected")}
 var jid string
 if err:=a.operational.QueryRowContext(ctx,"SELECT jid FROM sessions WHERE id=?",id).Scan(&jid);err!=nil{return err}
 var saved *store.Device
 if jid!=""{
  j,err:=types.ParseJID(jid);if err!=nil{return err}
  saved,err=a.storage.GetDevice(ctx,j);if err!=nil{return err}
  if saved==nil{return fmt.Errorf("stored device %s is missing",jid)}
 }else{
  saved=a.storage.NewDevice()
 }
 client:=whatsmeow.NewClient(saved,nil)
 d:=&device{client:client}
 a.clients[id]=d
 client.AddEventHandler(func(raw any){
  switch e:=raw.(type){
  case *events.PairSuccess:
   _,_=a.operational.Exec("UPDATE sessions SET jid=?,state='paired' WHERE id=?",e.ID.String(),id)
  case *events.Connected:
   _,_=a.operational.Exec("UPDATE sessions SET state='connected' WHERE id=?",id)
  case *events.Disconnected:
   _,_=a.operational.Exec("UPDATE sessions SET state='disconnected' WHERE id=?",id)
  case *events.LoggedOut:
   _,_=a.operational.Exec("UPDATE sessions SET state='logged_out',jid='' WHERE id=?",id)
  case *events.Message:
   if sink==nil{return}
   text:=""
   if e.Message!=nil{text=e.Message.GetConversation();if text==""{text=e.Message.GetExtendedTextMessage().GetText()}}
   _=sink.OnMessage(context.Background(),provider.Incoming{
    SessionID:id,MessageID:string(e.Info.ID),ChatID:e.Info.Chat.String(),SenderID:e.Info.Sender.String(),Text:text,
   })
  }
 })
 if saved.ID==nil{
  qrChan,err:=client.GetQRChannel(context.Background())
  if err!=nil{delete(a.clients,id);return err}
  go func(){
   for item:=range qrChan{
    a.mu.Lock()
    if current,ok:=a.clients[id];ok&&current==d{
     if item.Event=="code"{d.qr=item.Code;d.qrTime=time.Now().UTC()}else if item.Event=="success"{d.qr="";d.qrTime=time.Time{}}
    }
    a.mu.Unlock()
   }
  }()
 }
 if err:=client.Connect();err!=nil{
  delete(a.clients,id);return err
 }
 _,_=a.operational.ExecContext(ctx,"UPDATE sessions SET state='connecting' WHERE id=? AND jid=''",id)
 return nil
}
func(a *Adapter) Stop(_ context.Context,id string)error{
 a.mu.Lock();defer a.mu.Unlock()
 d,ok:=a.clients[id];if !ok{return provider.ErrNotConnected}
 d.client.Disconnect();delete(a.clients,id)
 _,err:=a.operational.Exec("UPDATE sessions SET state='disconnected' WHERE id=?",id)
 return err
}
func(a *Adapter) Status(_ context.Context,id string)(provider.SessionStatus,error){
 a.mu.RLock();defer a.mu.RUnlock()
 d,ok:=a.clients[id];if !ok{return provider.StatusDisconnected,nil}
 if d.client.IsLoggedIn()&&d.client.IsConnected(){return provider.StatusConnected,nil}
 if d.client.IsConnected(){return provider.StatusConnecting,nil}
 return provider.StatusDisconnected,nil
}
// QR is ephemeral in memory. Never write pairing tokens to disk, logs or MCP tools.
func(a *Adapter) QR(id string)(string,bool){
 a.mu.RLock();defer a.mu.RUnlock()
 d,ok:=a.clients[id];if !ok||d.qr==""||time.Since(d.qrTime)>55*time.Second{return "",false}
 return d.qr,true
}
func(a *Adapter) Send(ctx context.Context,r provider.SendRequest)(provider.SendReceipt,error){
 a.mu.RLock();d,ok:=a.clients[r.SessionID];a.mu.RUnlock()
 if !ok||!d.client.IsLoggedIn()||!d.client.IsConnected(){return provider.SendReceipt{},provider.ErrNotConnected}
 jid,err:=recipient(r.Recipient);if err!=nil{return provider.SendReceipt{},err}
 resp,err:=d.client.SendMessage(ctx,jid,&waE2E.Message{Conversation:proto.String(r.Text)})
 if err!=nil{return provider.SendReceipt{},err}
 return provider.SendReceipt{ProviderMessageID:string(resp.ID)},nil
}
func recipient(s string)(types.JID,error){
 if strings.Contains(s,"@"){
  j,e:=types.ParseJID(s)
  if e!=nil||j.User==""{return types.JID{},errors.New("invalid recipient jid")}
  return j,nil
 }
 if len(s)<8||len(s)>16{return types.JID{},errors.New("invalid phone")}
 for _,c:=range s{if c<'0'||c>'9'{return types.JID{},errors.New("invalid phone")}}
 return types.NewJID(s,types.DefaultUserServer),nil
}

func(a *Adapter) Logout(ctx context.Context,id string)error{
 a.mu.Lock();defer a.mu.Unlock()
 d,ok:=a.clients[id];if !ok{return provider.ErrNotConnected}
 if err:=d.client.Logout(ctx);err!=nil{return err}
 delete(a.clients,id)
 _,err:=a.operational.ExecContext(ctx,"UPDATE sessions SET jid='',state='logged_out' WHERE id=?",id)
 return err
}
func(a *Adapter) Groups(ctx context.Context,id string)([]string,error){
 a.mu.RLock();d,ok:=a.clients[id];a.mu.RUnlock()
 if !ok||!d.client.IsLoggedIn(){return nil,provider.ErrNotConnected}
 groups,err:=d.client.GetJoinedGroups(ctx);if err!=nil{return nil,err}
 ids:=make([]string,0,len(groups));for _,g:=range groups{ids=append(ids,g.JID.String())}
 return ids,nil
}
