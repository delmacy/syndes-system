package main

import (
	"context"
	"testing"

	waE2E "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

func TestAcceptedChatTextIgnoresReactionsAndProtocols(t *testing.T) {
	reaction := &events.Message{Message: &waE2E.Message{ReactionMessage: &waE2E.ReactionMessage{}}}
	protocol := &events.Message{Message: &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{}}}
	if acceptedChatText(reaction) != "" {
		t.Fatal("reaction must not become an Inbox text or bot input")
	}
	if acceptedChatText(protocol) != "" {
		t.Fatal("protocol event must not become an Inbox text")
	}
	message := &events.Message{Message: &waE2E.Message{Conversation: new("texto direto")}}
	if acceptedChatText(message) != "texto direto" {
		t.Fatal("ordinary direct text must be retained")
	}
}
func TestHistoryChatKindsAndTimestamp(t *testing.T) {
	if historyTimestamp(0) != "" {
		t.Fatal("missing timestamps must not become the Unix epoch")
	}
	for _, server := range []string{types.DefaultUserServer, types.HiddenUserServer, types.GroupServer} {
		if !validChatJID(types.JID{User: "1234567890123", Server: server}) {
			t.Fatalf("valid chat type %s rejected", server)
		}
	}
	if validChatJID(types.JID{User: "1234567890123", Server: types.NewsletterServer}) {
		t.Fatal("newsletter is not an Inbox chat")
	}
}
func TestHistoryRequestRejectsUnboundedHistory(t *testing.T) {
	g := &whatsmeowGateway{}
	if err := g.RequestHistory(context.Background(), "account", historyRequest{Count: 500}); err == nil {
		t.Fatal("unbounded history request accepted")
	}
}
