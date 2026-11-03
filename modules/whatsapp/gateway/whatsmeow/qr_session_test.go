package main

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestQRSessionCanBeReadAcrossRequests(t *testing.T) {
	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	session := newQRSession(cancel)
	session.publish("first-live-code", 60*time.Second)
	one, err := session.latest(context.Background())
	if err != nil || one.PairingCode != "first-live-code" {
		t.Fatalf("initial QR missing: %v", err)
	}
	if time.Until(one.ExpiresAt) < 55*time.Second {
		t.Fatal("QR expiry must use provider timeout")
	}
	second, err := session.latest(context.Background())
	if err != nil || second.PairingCode != one.PairingCode {
		t.Fatal("subsequent HTTP request lost active QR")
	}
	session.publish("rotated-code", 20*time.Second)
	rotated, err := session.latest(context.Background())
	if err != nil || rotated.PairingCode != "rotated-code" {
		t.Fatal("QR rotation not returned")
	}
	if time.Until(rotated.ExpiresAt) > 25*time.Second {
		t.Fatal("QR rotation must use new provider timeout")
	}
}

func TestQRSessionRequestCancellationDoesNotStopSession(t *testing.T) {
	_, cancel := context.WithCancel(context.Background())
	defer cancel()
	session := newQRSession(cancel)
	reqCtx, stopReq := context.WithCancel(context.Background())
	stopReq()
	if _, err := session.latest(reqCtx); !errors.Is(err, context.Canceled) {
		t.Fatalf("expected request cancellation, got %v", err)
	}
	session.publish("usable-after-cancellation", 60*time.Second)
	if result, err := session.latest(context.Background()); err != nil || result.PairingCode != "usable-after-cancellation" {
		t.Fatal("HTTP request cancellation unexpectedly ended QR stream")
	}
	session.finish(errors.New("session stopped"))
	if _, err := session.latest(context.Background()); err == nil {
		t.Fatal("finished QR session was reused")
	}
}
