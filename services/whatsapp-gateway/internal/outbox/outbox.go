package outbox

import (
 "context"
 "database/sql"
 "errors"
 "time"
)

var ErrUnauthorized = errors.New("tenant not authorized for session")
var ErrInvalid = errors.New("invalid outbound request")

// Outbox is an at-least-once durable queue. All callers must use stable idempotency IDs.
// Provider dispatch MUST use a separately authenticated tenant identity.
type Outbox struct{ DB *sql.DB }
type Job struct {
 ID string `json:"id"`
 SessionID string `json:"session_id"`
 TenantID string `json:"tenant_id"`
 Recipient string `json:"recipient"`
 Body string `json:"body"`
 Priority int `json:"priority"`
 State string `json:"state"`
 Attempts int `json:"attempts"`
}
func (q Outbox) Init(ctx context.Context)error {
 _,err:=q.DB.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS outbox (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE RESTRICT,
 tenant_id TEXT NOT NULL,
 recipient TEXT NOT NULL,
 body TEXT NOT NULL,
 priority INTEGER NOT NULL DEFAULT 2 CHECK(priority BETWEEN 0 AND 3),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','sent','failed')),
 attempts INTEGER NOT NULL DEFAULT 0,
 available_at INTEGER NOT NULL,
 claimed_until INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
 );
 CREATE INDEX IF NOT EXISTS idx_outbox_poll ON outbox(state,available_at,priority,created_at);
 CREATE TABLE IF NOT EXISTS send_limits(session_id TEXT PRIMARY KEY,window_start INTEGER NOT NULL,used INTEGER NOT NULL);`)
 return err
}
// Enqueue atomically checks the tenant/session authorization and inserts the job.
// Identical idempotency keys cannot result in two jobs.
func(q Outbox) Enqueue(ctx context.Context,j Job)error{
 if j.ID==""||j.SessionID==""||j.TenantID==""||j.Recipient==""||j.Body==""||len(j.Body)>65536||j.Priority<0||j.Priority>3{return ErrInvalid}
 tx,e:=q.DB.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 var authorized int
 e=tx.QueryRowContext(ctx,"SELECT count(*) FROM links WHERE session_id=? AND tenant_id=? AND can_send=1",j.SessionID,j.TenantID).Scan(&authorized)
 if e!=nil{return e};if authorized==0{return ErrUnauthorized}
 now:=time.Now().Unix()
 _,e=tx.ExecContext(ctx,`INSERT INTO outbox(id,session_id,tenant_id,recipient,body,priority,available_at,created_at)
 VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,j.ID,j.SessionID,j.TenantID,j.Recipient,j.Body,j.Priority,now,now)
 if e!=nil{return e};return tx.Commit()
}
// Claim enforces a shared 40-message/minute limit per WhatsApp session,
// including all tenants authorized to use it. Leases allow retry after worker failure.
func(q Outbox) Claim(ctx context.Context,session string,now time.Time)(*Job,error){
 tx,e:=q.DB.BeginTx(ctx,nil);if e!=nil{return nil,e};defer tx.Rollback()
 ts:=now.Unix();window:=ts/60
 _,e=tx.ExecContext(ctx,`INSERT INTO send_limits(session_id,window_start,used) VALUES(?,?,0)
 ON CONFLICT(session_id) DO UPDATE SET window_start=excluded.window_start,used=0 WHERE window_start<>excluded.window_start`,session,window)
 if e!=nil{return nil,e}
 var used int;e=tx.QueryRowContext(ctx,"SELECT used FROM send_limits WHERE session_id=?",session).Scan(&used);if e!=nil{return nil,e}
 if used>=40{return nil,nil}
 // Recheck authorization at dispatch: a revoked link must not allow queued sends.
 row:=tx.QueryRowContext(ctx,`SELECT o.id,o.session_id,o.tenant_id,o.recipient,o.body,o.priority,o.state,o.attempts
 FROM outbox o JOIN links l ON l.session_id=o.session_id AND l.tenant_id=o.tenant_id AND l.can_send=1
 WHERE o.session_id=? AND o.available_at<=? AND (o.state='queued' OR (o.state='processing' AND o.claimed_until<=?))
 ORDER BY o.priority ASC,o.created_at ASC,o.id ASC LIMIT 1`,session,ts,ts)
 var j Job;e=row.Scan(&j.ID,&j.SessionID,&j.TenantID,&j.Recipient,&j.Body,&j.Priority,&j.State,&j.Attempts)
 if errors.Is(e,sql.ErrNoRows){return nil,nil};if e!=nil{return nil,e}
 _,e=tx.ExecContext(ctx,"UPDATE outbox SET state='processing',claimed_until=?,attempts=attempts+1 WHERE id=?",ts+60,j.ID);if e!=nil{return nil,e}
 _,e=tx.ExecContext(ctx,"UPDATE send_limits SET used=used+1 WHERE session_id=?",session);if e!=nil{return nil,e}
 if e=tx.Commit();e!=nil{return nil,e};j.State="processing";j.Attempts++;return &j,nil
}
func(q Outbox) Complete(ctx context.Context,id string,sent bool)error{
 state:="sent";if !sent{state="queued"}
 _,e:=q.DB.ExecContext(ctx,"UPDATE outbox SET state=?,claimed_until=0,available_at=? WHERE id=? AND state='processing'",state,time.Now().Add(time.Minute).Unix(),id)
 return e
}
