package main

import ("testing";"os";"strings")

func TestTenantRegistryTokenScope(t *testing.T) {
 master:="test-secret"
 tenantA:="00000000-0000-4000-8000-000000000001"
 tenantB:="00000000-0000-4000-8000-000000000002"
 token:=tenantToken(master,tenantA)
 if !authorizedTenant("Bearer "+token,master,tenantA){t.Fatal("tenant token rejected")}
 if authorizedTenant("Bearer "+token,master,tenantB){t.Fatal("cross tenant accepted")}
 if authorizedTenant("Bearer "+master,master,tenantA){t.Fatal("master token accepted")}
 if authorizedTenant("Bearer "+token,master,"not-a-uuid"){t.Fatal("invalid tenant accepted")}
}

func TestOutboxStatusRouteHasAccountAndTenantSelectors(t *testing.T) {
 source,err:=os.ReadFile("accounts_http.go")
 if err!=nil {t.Fatal(err)}
 for _,want:=range []string{
  "/v1/tenants/{tenantId}/accounts/{accountId}/outbox/{queueId}",
  "a.tenant_id=$1 AND o.account_id=$2 AND o.id=$3",
  "authorizedTenant(r.Header.Get",
 } {
  if !strings.Contains(string(source),want) {t.Errorf("missing %s",want)}
 }
}
