package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestConstantTimeBearer(t *testing.T) {
	if !constantTimeBearer("Bearer secret", "secret") {
		t.Fatal("expected valid bearer token")
	}
	for _, value := range []string{"", "secret", "Bearer wrong", "Bearer secre"} {
		if constantTimeBearer(value, "secret") {
			t.Fatalf("unexpected authorization for %q", value)
		}
	}
}

func TestValidUUID(t *testing.T) {
	if !validUUID("00000000-0000-4000-8000-000000000001") {
		t.Fatal("expected UUID to be valid")
	}
	if validUUID("../../tenant") {
		t.Fatal("path selector must be rejected")
	}
}

func TestParseRecipient(t *testing.T) {
	jid, err := parseRecipient("+5511999999999")
	if err != nil {
		t.Fatal(err)
	}
	if jid.String() != "5511999999999@s.whatsapp.net" {
		t.Fatalf("unexpected JID: %s", jid.String())
	}
}

func TestCallbackRetriesUntilAccepted(t *testing.T) {
	var attempts atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer webhook-secret" {
			t.Fatal("missing webhook authorization")
		}
		if attempts.Add(1) < 3 {
			writer.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		writer.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	callback := &callbackClient{baseURL: server.URL, token: "webhook-secret", client: &http.Client{Timeout: time.Second}}
	err := callback.deliver(context.Background(), "00000000-0000-4000-8000-000000000001", inboundEvent{ExternalMessageID: "message-1", SenderExternalID: "5511@s.whatsapp.net", Body: "hello", OccurredAt: time.Now().UTC().Format(time.RFC3339Nano)})
	if err != nil {
		t.Fatal(err)
	}
	if attempts.Load() != 3 {
		t.Fatalf("expected 3 attempts, got %d", attempts.Load())
	}
}

func TestAccountTokensAreIsolated(t *testing.T) {
	master := "test-only-secret"
	tenantA := "00000000-0000-4000-8000-000000000001"
	tenantB := "00000000-0000-4000-8000-000000000002"
	accountA := "00000000-0000-4000-8000-000000000011"
	accountB := "00000000-0000-4000-8000-000000000012"
	one := accountToken(master, tenantA, accountA)
	if len(one) != 64 {
		t.Fatal("unexpected token size")
	}
	if one == accountToken(master, tenantA, accountB) {
		t.Fatal("account tokens must differ")
	}
	if one == accountToken(master, tenantB, accountA) {
		t.Fatal("tenant tokens must differ")
	}
}

func TestCallbackCarriesVersionedTenantAccountEnvelope(t *testing.T) {
	tenantID := "00000000-0000-4000-8000-000000000001"
	accountID := "00000000-0000-4000-8000-000000000011"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Syndes-Event-Version") != "1" {
			t.Error("wrong envelope version")
		}
		if r.Header.Get("X-Syndes-Event-Type") != "whatsapp.message.received" {
			t.Error("wrong event type")
		}
		var body struct {
			Version   string       `json:"version"`
			Type      string       `json:"type"`
			TenantID  string       `json:"tenantId"`
			AccountID string       `json:"accountId"`
			Message   inboundEvent `json:"message"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
			w.WriteHeader(400)
			return
		}
		if body.Version != "1" || body.Type != "whatsapp.message.received" || body.TenantID != tenantID || body.AccountID != accountID || body.Message.ExternalMessageID != "m1" {
			t.Errorf("wrong event envelope: %+v", body)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()
	callback := &callbackClient{baseURL: server.URL, token: "test", client: server.Client()}
	if err := callback.deliver(context.Background(), tenantID, inboundEvent{AccountID: accountID, ExternalMessageID: "m1", Body: "hello"}); err != nil {
		t.Fatal(err)
	}
}
