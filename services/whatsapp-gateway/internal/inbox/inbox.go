package inbox

import (
 "context"
 "database/sql"
 "errors"
 "time"
)

var ErrInvalid = errors.New("invalid inbound event")
type Event struct{
 SessionID string `json:"session_id"`
 MessageID string `json:"message_id"`
 ChatID string `json:"chat_id"`
 SenderID string `json:"sender_id"`
 Kind string `json:"kind"`
 Payload string `json:"payload"`
}
type Store struct{ DB *sql.DB }
func(s Store) Init(ctx context.Context)error{
 _,err:=s.DB.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS inbound_events(
 session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE RESTRICT,
 message_id TEXT NOT NULL,
 chat_id TEXT NOT NULL,
 sender_id TEXT NOT NULL,
 kind TEXT NOT NULL,
 payload TEXT NOT NULL,
 received_at INTEGER NOT NULL,
 PRIMARY KEY(session_id,message_id)
 );
 CREATE INDEX IF NOT EXISTS inbound_events_by_session ON inbound_events(session_id,received_at);`)
 return err
}
// Insert returns false for duplicate WhatsApp delivery. Tenant routing intentionally
// does not happen here: an explicit conversation assignment must resolve it later.
func(s Store) Insert(ctx context.Context,e Event)(bool,error){
 if e.SessionID==""||e.MessageID==""||e.ChatID==""||e.SenderID==""||e.Kind==""||len(e.Payload)>1048576{return false,ErrInvalid}
 r,err:=s.DB.ExecContext(ctx,`INSERT INTO inbound_events(session_id,message_id,chat_id,sender_id,kind,payload,received_at)
 VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id,message_id) DO NOTHING`,
 e.SessionID,e.MessageID,e.ChatID,e.SenderID,e.Kind,e.Payload,time.Now().Unix())
 if err!=nil{return false,err};n,err:=r.RowsAffected();return n==1,err
}
