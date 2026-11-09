package main

import (
	"go.mau.fi/whatsmeow/types"
	"testing"
)

func TestContactSyncPrefersSavedAddressBookAndRejectsBogusNames(t *testing.T) {
	info := types.ContactInfo{FullName: "Nome Salvo", BusinessName: "Empresa", PushName: "Apelido"}
	if got := preferredContactName(info); got != "Nome Salvo" {
		t.Fatalf("want saved name, got %q", got)
	}
	info.FullName = ""
	if got := preferredContactName(info); got != "Empresa" {
		t.Fatalf("want business name, got %q", got)
	}
	for _, n := range []string{"", "-", "   ", "x" + string(make([]byte, 161))} {
		if got := safeContactName(n); got != "" {
			t.Errorf("unsafe name accepted")
		}
	}
}
