package main

import (
 "os"
 "strings"
 "testing"
)

func TestGatewayUsesAccountScopedRoutesAndSessions(t *testing.T) {
 mainSource, err := os.ReadFile("main.go")
 if err != nil { t.Fatal(err) }
 gatewaySource, err := os.ReadFile("gateway.go")
 if err != nil { t.Fatal(err) }
 for _, want := range []string{"/v1/accounts/{accountId}/{operation}", "syndes_whatsapp_accounts", "account_id uuid PRIMARY KEY"} {
  if !strings.Contains(string(mainSource),want) { t.Errorf("missing %s",want) }
 }
 for _, want := range []string{"gateway.clients[accountID]", "WHERE account_id=$1 AND enabled=true", "AccountID: accountID"} {
  if !strings.Contains(string(gatewaySource),want) { t.Errorf("missing %s",want) }
 }
}
