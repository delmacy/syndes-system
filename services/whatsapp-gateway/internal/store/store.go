package store

import (
 "context"
 "database/sql"
 "errors"
 "fmt"
 "time"
 _ "github.com/mattn/go-sqlite3"
)

type Store struct { DB *sql.DB }
type Session struct { ID string `json:"id"`; JID string `json:"jid"`; State string `json:"state"`; Created string `json:"created"` }
type Link struct { SessionID string `json:"session_id"`; TenantID string `json:"tenant_id"`; CanSend bool `json:"can_send"` }
func Open(path string) (*Store,error) {
 db,err:=sql.Open("sqlite3","file:"+path+"?_foreign_keys=on&_busy_timeout=5000&_journal_mode=WAL")
 if err!=nil{return nil,err}
 db.SetMaxOpenConns(1)
 s:=&Store{db}
 for _,ddl:=range []string{
 `CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,jid TEXT NOT NULL DEFAULT '',state TEXT NOT NULL DEFAULT 'created',created TEXT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS links(session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,tenant_id TEXT NOT NULL,can_send INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(session_id,tenant_id))`,
 `CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT,kind TEXT NOT NULL,created TEXT NOT NULL,detail TEXT NOT NULL DEFAULT '')`,
 `CREATE INDEX IF NOT EXISTS idx_links_tenant ON links(tenant_id)`,
 }{if _,err=db.Exec(ddl);err!=nil{db.Close();return nil,fmt.Errorf("migrate: %w",err)}}
 return s,nil
}
func(s *Store) Close()error{return s.DB.Close()}
func(s *Store) AddSession(ctx context.Context,id string)error{
 _,err:=s.DB.ExecContext(ctx,"INSERT INTO sessions(id,created) VALUES(?,?)",id,time.Now().UTC().Format(time.RFC3339));return err
}
func(s *Store) Sessions(ctx context.Context)([]Session,error){
 rows,err:=s.DB.QueryContext(ctx,"SELECT id,jid,state,created FROM sessions ORDER BY created DESC");if err!=nil{return nil,err};defer rows.Close()
 out:=[]Session{};for rows.Next(){var a Session;if err=rows.Scan(&a.ID,&a.JID,&a.State,&a.Created);err!=nil{return nil,err};out=append(out,a)};return out,rows.Err()
}
func(s *Store) Link(ctx context.Context,session,tenant string,canSend bool)error{
 _,err:=s.DB.ExecContext(ctx,"INSERT INTO links(session_id,tenant_id,can_send) VALUES(?,?,?) ON CONFLICT(session_id,tenant_id) DO UPDATE SET can_send=excluded.can_send",session,tenant,canSend);return err
}
func(s *Store) Allowed(ctx context.Context,session,tenant string) (bool,error){
 var n int;err:=s.DB.QueryRowContext(ctx,"SELECT count(*) FROM links WHERE session_id=? AND tenant_id=? AND can_send=1",session,tenant).Scan(&n);return n>0,err
}
func(s *Store) Links(ctx context.Context)([]Link,error){
 rows,err:=s.DB.QueryContext(ctx,"SELECT session_id,tenant_id,can_send FROM links ORDER BY tenant_id,session_id");if err!=nil{return nil,err};defer rows.Close()
 out:=[]Link{};for rows.Next(){var a Link;err=rows.Scan(&a.SessionID,&a.TenantID,&a.CanSend);if err!=nil{return nil,err};out=append(out,a)};return out,rows.Err()
}
func(s *Store) RemoveLink(ctx context.Context,session,tenant string)error{r,err:=s.DB.ExecContext(ctx,"DELETE FROM links WHERE session_id=? AND tenant_id=?",session,tenant);if err!=nil{return err};n,_:=r.RowsAffected();if n==0{return errors.New("link not found")};return nil}
