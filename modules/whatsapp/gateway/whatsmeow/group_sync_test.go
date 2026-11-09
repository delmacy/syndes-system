package main

import (
	"testing"
)

func TestGroupChangeValidation(t *testing.T) {
	n := "Novo grupo"
	d := "Descrição"
	for _, valid := range []groupChange{{Name: &n}, {Description: &d}} {
		if err := validGroupChange(valid); err != nil {
			t.Fatal(err)
		}
	}
	for _, invalid := range []groupChange{{}, {Name: &n, Description: &d}} {
		if validGroupChange(invalid) == nil {
			t.Fatal("invalid group mutation accepted")
		}
	}
}
func TestGroupSnapshotRevisionChangesAfterNameChange(t *testing.T) {
	a := chatEvent{ChatExternalID: "120363012345678901@g.us", IsGroup: true, Name: "Antes"}
	b := a
	b.Name = "Depois"
	if chatSnapshotKey(a) == chatSnapshotKey(b) {
		t.Fatal("rename was deduplicated")
	}
	if chatSnapshotKey(a) != chatSnapshotKey(a) {
		t.Fatal("snapshot not idempotent")
	}
}
func TestOnlyWhatsAppGroupJIDs(t *testing.T) {
	if _, err := groupJID("120363012345678901@g.us"); err != nil {
		t.Fatal(err)
	}
	for _, input := range []string{"5551999999999@s.whatsapp.net", "1234567890123@lid", "bad"} {
		if _, err := groupJID(input); err == nil {
			t.Fatalf("accepted %s", input)
		}
	}
}
