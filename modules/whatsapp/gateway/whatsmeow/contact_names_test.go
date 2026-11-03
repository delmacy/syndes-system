package main

import (
	"go.mau.fi/whatsmeow/appstate"
	"testing"
)

func TestContactNamePatch(t *testing.T) {
	p, jid, err := contactNamePatch(contactNameChange{ContactJID: "5551999998888@s.whatsapp.net", FullName: "Maria Silva"})
	if err != nil {
		t.Fatal(err)
	}
	if p.Type != appstate.WAPatchCriticalUnblockLow || len(p.Mutations) != 1 {
		t.Fatal("invalid contact patch")
	}
	m := p.Mutations[0]
	a := m.Value.GetContactAction()
	if m.Version != 2 || m.Index[0] != appstate.IndexContact || m.Index[1] != jid.String() {
		t.Fatal("invalid mutation")
	}
	if a.GetFullName() != "Maria Silva" || a.GetFirstName() != "Maria" || a.GetSaveOnPrimaryAddressbook() {
		t.Fatal("unsafe contact mutation")
	}
}
func TestContactNameRejectsNonPhoneJIDs(t *testing.T) {
	for _, target := range []string{"123456789@g.us", "123456789012345@lid", "5551999998888:1@s.whatsapp.net"} {
		if _, _, err := contactNamePatch(contactNameChange{ContactJID: target, FullName: "Teste"}); err == nil {
			t.Fatal("accepted invalid JID")
		}
	}
}
