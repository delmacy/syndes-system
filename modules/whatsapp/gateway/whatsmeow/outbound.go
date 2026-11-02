package main

import (
 "context"
 "database/sql"
 "errors"
 "log/slog"
 "time"
)

// All outgoing requests are persisted before any WhatsApp network call.
func (gateway *whatsmeowGateway) Send(ctx context.Context, accountID string, input sendRequest) (sendResponse,error) {
 if input.IdempotencyKey=="" || len(input.IdempotencyKey)>160 || input.RecipientExternalID=="" || input.Body=="" || len(input.Body)>10000 {
  return sendResponse{},errors.New("invalid outgoing message")
 }
 var id int64
 err:=gateway.db.QueryRowContext(ctx,`INSERT INTO syndes_whatsapp_outbound(account_id,idempotency_key,recipient_external_id,body)
 SELECT $1,$2,$3,$4 WHERE EXISTS
 (SELECT 1 FROM syndes_whatsapp_accounts WHERE account_id=$1 AND enabled=true)
 ON CONFLICT(account_id,idempotency_key) DO UPDATE SET idempotency_key=EXCLUDED.idempotency_key
 WHERE syndes_whatsapp_outbound.recipient_external_id=EXCLUDED.recipient_external_id
 AND syndes_whatsapp_outbound.body=EXCLUDED.body
 RETURNING id`,accountID,input.IdempotencyKey,input.RecipientExternalID,input.Body).Scan(&id)
 if err!=nil {return sendResponse{},err}
 return sendResponse{QueueID:id},nil
}

func (gateway *whatsmeowGateway) startOutboundDispatcher(ctx context.Context) {
 // A crash after claiming may have sent the message. Mark uncertain, never blindly replay.
 if _,err:=gateway.db.ExecContext(ctx,`UPDATE syndes_whatsapp_outbound SET status='failed',last_error='uncertain after restart' WHERE status='processing'`);err!=nil {slog.Error("outbound recovery failed","error",err.Error());return}
 go func(){
  ticker:=time.NewTicker(time.Second); defer ticker.Stop()
  for { gateway.deliverOutbound(ctx); select {case <-ctx.Done():return;case <-ticker.C:} }
 }()
}
func (gateway *whatsmeowGateway) deliverOutbound(ctx context.Context) {
 rows,err:=gateway.db.QueryContext(ctx,`SELECT o.id,o.account_id::text,o.recipient_external_id,o.body,o.attempts
 FROM syndes_whatsapp_outbound o JOIN syndes_whatsapp_accounts a ON a.account_id=o.account_id
 WHERE a.enabled=true AND o.status='pending' AND o.next_attempt_at<=now() ORDER BY o.id LIMIT 25`)
 if err!=nil {if !errors.Is(err,context.Canceled){slog.Error("outbound query failed","error",err.Error())};return}
 type item struct{id int64; accountID,recipient,body string;attempts int}
 var pending []item
 for rows.Next(){var x item;if rows.Scan(&x.id,&x.accountID,&x.recipient,&x.body,&x.attempts)==nil{pending=append(pending,x)}}
 _=rows.Close()
 for _,x:=range pending {
  // Claim + rate reservation are serialized under one transaction and row lock.
  tx,err:=gateway.db.BeginTx(ctx,nil);if err!=nil {return}
  var accountID string
  err=tx.QueryRowContext(ctx,`SELECT account_id::text FROM syndes_whatsapp_accounts WHERE account_id=$1 AND enabled=true FOR UPDATE`,x.accountID).Scan(&accountID)
  if err!=nil {_=tx.Rollback();continue}
  var count int
  err=tx.QueryRowContext(ctx,`INSERT INTO syndes_whatsapp_send_windows(account_id,minute,count) VALUES($1,date_trunc('minute',clock_timestamp()),1)
  ON CONFLICT(account_id,minute) DO UPDATE SET count=syndes_whatsapp_send_windows.count+1
  WHERE syndes_whatsapp_send_windows.count<40 RETURNING count`,x.accountID).Scan(&count)
  if err!=nil {_=tx.Rollback();continue}
  claimed,err:=tx.ExecContext(ctx,`UPDATE syndes_whatsapp_outbound SET status='processing',updated_at=now() WHERE id=$1 AND status='pending'`,x.id)
  if err!=nil {_=tx.Rollback();continue}
  affected,_:=claimed.RowsAffected()
  if affected!=1 {_=tx.Rollback();continue}
  if err=tx.Commit();err!=nil {continue}
  result,sendErr:=gateway.sendDirect(ctx,x.accountID,sendRequest{RecipientExternalID:x.recipient,Body:x.body})
  if sendErr==nil{
   _,_=gateway.db.ExecContext(ctx,`UPDATE syndes_whatsapp_outbound SET status='sent',external_message_id=$2,updated_at=now() WHERE id=$1`,x.id,result.ExternalMessageID)
  }else{
   // Unknown result must not be resent automatically: exactly-once on WhatsApp is not guaranteed.
   _,_=gateway.db.ExecContext(ctx,`UPDATE syndes_whatsapp_outbound SET status='failed',attempts=attempts+1,last_error='delivery uncertain',updated_at=now() WHERE id=$1`,x.id)
   slog.Warn("outbound delivery failed; manual reconciliation required","queue_id",x.id)
  }
 }
}

func migrateOutbound(ctx context.Context,db *sql.DB) error {
 _,err:=db.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS syndes_whatsapp_outbound(
 id bigserial PRIMARY KEY,account_id uuid NOT NULL REFERENCES syndes_whatsapp_accounts(account_id),
 idempotency_key text NOT NULL,recipient_external_id text NOT NULL,body text NOT NULL,
 status text NOT NULL DEFAULT 'pending',attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),external_message_id text,last_error text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(account_id,idempotency_key));
 CREATE TABLE IF NOT EXISTS syndes_whatsapp_send_windows(
 account_id uuid NOT NULL REFERENCES syndes_whatsapp_accounts(account_id),
 minute timestamptz NOT NULL,count integer NOT NULL CHECK(count BETWEEN 0 AND 40),
 PRIMARY KEY(account_id,minute));`)
 return err
}
