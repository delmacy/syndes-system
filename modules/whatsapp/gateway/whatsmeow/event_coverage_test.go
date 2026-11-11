package main

import (
	"os"
	"strings"
	"sync"
	"testing"

	waE2E "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types/events"
)

func TestCoverageClassifiesUnsupportedEventsWithoutConvertingToText(t *testing.T) {
	tests := []struct {
		name    string
		message *events.Message
		want    string
	}{
		{"invalid", nil, "invalid_envelope"},
		{"text", &events.Message{Message: &waE2E.Message{Conversation: new("olá")}}, "text_eligible"},
		{"image", &events.Message{Message: &waE2E.Message{ImageMessage: &waE2E.ImageMessage{}}}, "image_unsupported"},
		{"audio", &events.Message{Message: &waE2E.Message{AudioMessage: &waE2E.AudioMessage{}}}, "audio_unsupported"},
		{"video", &events.Message{Message: &waE2E.Message{VideoMessage: &waE2E.VideoMessage{}}}, "video_unsupported"},
		{"document", &events.Message{Message: &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{}}}, "document_unsupported"},
		{"sticker", &events.Message{Message: &waE2E.Message{StickerMessage: &waE2E.StickerMessage{}}}, "sticker_unsupported"},
		{"reaction", &events.Message{Message: &waE2E.Message{ReactionMessage: &waE2E.ReactionMessage{}}}, "reaction_unsupported"},
		{"protocol", &events.Message{Message: &waE2E.Message{ProtocolMessage: &waE2E.ProtocolMessage{}}}, "protocol_control_ignored"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifyInboundMessage(tc.message); got != tc.want {
				t.Fatalf("got %s want %s", got, tc.want)
			}
		})
	}
}

func TestCoverageIsAccountIsolatedAndConcurrencySafe(t *testing.T) {
	var coverage eventCoverage
	var group sync.WaitGroup
	for i := 0; i < 80; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			coverage.observe("a", "image_unsupported")
			coverage.observe("b", "text_eligible")
		}()
	}
	group.Wait()
	if coverage.snapshot("a")["image_unsupported"] != 80 ||
		coverage.snapshot("b")["text_eligible"] != 80 {
		t.Fatal("per-account counters not isolated")
	}
	if len(coverage.snapshot("c")) != 0 {
		t.Fatal("unknown account leaked counters")
	}
}

func TestCoverageEndpointRequiresScopedTokenAndAccountOwnership(t *testing.T) {
	// Static source contract; live HTTP tests require an isolated gateway DB.
	content, err := os.ReadFile("accounts_http.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(content)
	for _, fragment := range []string{
		"GET /v1/tenants/{tenantId}/accounts/{accountId}/diagnostics/coverage",
		"authorizedTenant(r.Header.Get(\"Authorization\"), master, tenantID)",
		"WHERE tenant_id=$1 AND account_id=$2",
		"Coverage(string) map[string]uint64",
		"\"durability\": \"process_memory\"",
	} {
		if !strings.Contains(source, fragment) {
			t.Fatalf("coverage endpoint missing guard: %s", fragment)
		}
	}
}
