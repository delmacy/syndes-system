package main

import (
 "context"
 "database/sql"
 "errors"
 "os"
 "testing"
 "time"

 _ "github.com/jackc/pgx/v5/stdlib"
)

func TestPostgresAccountQuotaAndOutbox(t *testing.T) {
 dsn:=os.Getenv("SYNDES_WHATSAPP_TEST_PG_DSN")
 if dsn=="" {t.Skip("dedicated test PostgreSQL not configured")}
 db,err:=sql.Open("pgx",dsn)
 if err!=nil {t.Fatal(err)}
 defer db.Close()
 ctx,cancel:=context.WithTimeout(context.Background(),40*time.Second);defer cancel()
 _,err=db.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS syndes_whatsapp_accounts(
 account_id uuid PRIMARY KEY,tenant_id uuid NOT NULL,device_jid text UNIQUE,
 enabled boolean NOT NULL DEFAULT true,updated_at timestamptz DEFAULT now())`)
 if err!=nil {t.Fatal(err)}
 if err:=migrateOutbound(ctx,db);err!=nil{t.Fatal(err)}
 tenantID:="00000000-0000-4000-8000-000000000099"
 accountID:="00000000-0000-4000-8000-000000000098"
 _,err=db.ExecContext(ctx,`INSERT INTO syndes_whatsapp_accounts(account_id,tenant_id) VALUES($1,$2)
 ON CONFLICT(account_id) DO UPDATE SET enabled=true`,accountID,tenantID)
 if err!=nil {t.Fatal(err)}
 defer func(){_,_=db.Exec(`DELETE FROM syndes_whatsapp_outbound WHERE account_id=$1`,accountID);_,_=db.Exec(`DELETE FROM syndes_whatsapp_send_windows WHERE account_id=$1`,accountID);_,_=db.Exec(`DELETE FROM syndes_whatsapp_accounts WHERE account_id=$1`,accountID)}()
 _,_=db.ExecContext(ctx,`DELETE FROM syndes_whatsapp_send_windows WHERE account_id=$1`,accountID)
 for i:=0;i<41;i++ {
  var n int
  err:=db.QueryRowContext(ctx,`INSERT INTO syndes_whatsapp_send_windows(account_id,minute,count)
 VALUES($1,date_trunc('minute',clock_timestamp()),1)
 ON CONFLICT(account_id,minute) DO UPDATE SET count=syndes_whatsapp_send_windows.count+1
 WHERE syndes_whatsapp_send_windows.count<40 RETURNING count`,accountID).Scan(&n)
  if i<40 && (err!=nil||n!=i+1){t.Fatalf("reservation %d: count %d, error %v",i,n,err)}
  if i==40 && !errors.Is(err,sql.ErrNoRows){t.Fatalf("41st reservation must be rejected: %v",err)}
 }
}
