package main

import "testing"

func TestTenantRegistryTokenScope(t *testing.T) {
	master := "test-secret"
	tenantA := "00000000-0000-4000-8000-000000000001"
	tenantB := "00000000-0000-4000-8000-000000000002"
	token := tenantToken(master, tenantA)
	if !authorizedTenant("Bearer "+token, master, tenantA) {
		t.Fatal("tenant token rejected")
	}
	if authorizedTenant("Bearer "+token, master, tenantB) {
		t.Fatal("cross tenant accepted")
	}
	if authorizedTenant("Bearer "+master, master, tenantA) {
		t.Fatal("master token accepted")
	}
	if authorizedTenant("Bearer "+token, master, "not-a-uuid") {
		t.Fatal("invalid tenant accepted")
	}
}
