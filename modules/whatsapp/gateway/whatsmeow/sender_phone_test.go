package main

import (
	"go.mau.fi/whatsmeow/types"
	"testing"
)

func TestVerifiedPhoneDoesNotTreatLIDAsPhone(t *testing.T) {
	cases := []struct {
		jid      types.JID
		expected string
	}{
		{types.JID{User: "5551976471234", Server: types.DefaultUserServer}, "+5551976471234"},
		{types.JID{User: "76467123456789", Server: types.HiddenUserServer}, ""},
		{types.JID{User: "not-a-number", Server: types.DefaultUserServer}, ""},
		{types.JID{User: "001234567890", Server: types.DefaultUserServer}, ""},
	}
	for _, c := range cases {
		if actual := verifiedPhone(c.jid); actual != c.expected {
			t.Errorf("verifiedPhone returned %q (wanted %q)", actual, c.expected)
		}
	}
}
func TestSenderPhoneUsesVerifiedAlternativeJID(t *testing.T) {
	source := types.MessageSource{
		Sender:    types.JID{User: "76467123456789", Server: types.HiddenUserServer},
		SenderAlt: types.JID{User: "5551976471234", Server: types.DefaultUserServer},
	}
	if found := senderPhoneForMessage(nil, source); found != "+5551976471234" {
		t.Fatalf("unexpected alternative number %q", found)
	}
	source.SenderAlt = types.EmptyJID
	if found := senderPhoneForMessage(nil, source); found != "" {
		t.Fatal("a raw LID was misidentified as a phone")
	}
}
