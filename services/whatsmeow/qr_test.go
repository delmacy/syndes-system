package main

import (
	"context"
	"sync"
	"testing"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
)

// fakePairingClient is a deterministic unit fake for whatsAppClient. It never
// touches the network and exposes the QR channel so tests can feed code
// rotations and final/error states synchronously.
type fakePairingClient struct {
	mu        sync.Mutex
	channel   chan whatsmeow.QRChannelItem
	qrCalls   int
	connected bool
	loggedIn  bool
	pairedID  *types.JID
}

func newFakePairingClient() *fakePairingClient {
	return &fakePairingClient{
		channel: make(chan whatsmeow.QRChannelItem, 8),
	}
}

func (f *fakePairingClient) AddEventHandler(handler whatsmeow.EventHandler) uint32 { return 0 }
func (f *fakePairingClient) GetQRChannel(context.Context) (<-chan whatsmeow.QRChannelItem, error) {
	f.mu.Lock()
	f.qrCalls++
	ch := f.channel
	f.mu.Unlock()
	return ch, nil
}
func (f *fakePairingClient) Connect() error {
	f.mu.Lock()
	f.connected = true
	f.mu.Unlock()
	return nil
}
func (f *fakePairingClient) Disconnect() {
	f.mu.Lock()
	f.connected = false
	f.mu.Unlock()
}
func (f *fakePairingClient) IsConnected() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.connected
}
func (f *fakePairingClient) IsLoggedIn() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.loggedIn
}
func (f *fakePairingClient) SendMessage(context.Context, types.JID, *waE2E.Message, ...whatsmeow.SendRequestExtra) (whatsmeow.SendResponse, error) {
	return whatsmeow.SendResponse{ID: "msg-1"}, nil
}
func (f *fakePairingClient) PairedID() *types.JID {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.pairedID
}

func (f *fakePairingClient) setPaired(id string) {
	jid, _ := types.ParseJID(id)
	f.mu.Lock()
	f.pairedID = &jid
	f.mu.Unlock()
}

func newGatewayWithClient(client whatsAppClient) *whatsmeowGateway {
	ctx, cancel := context.WithCancel(context.Background())
	return &whatsmeowGateway{
		ctx:        ctx,
		cancel:     cancel,
		clients:    map[string]whatsAppClient{"tenant-1": client},
		qrSessions: map[string]*qrSession{},
	}
}

func qrSessionFor(gateway *whatsmeowGateway, tenantID string) *qrSession {
	gateway.mu.RLock()
	defer gateway.mu.RUnlock()
	return gateway.qrSessions[tenantID]
}

func TestPairServesFirstCodeAndRotatedCode(t *testing.T) {
	fake := newFakePairingClient()
	defer close(fake.channel)
	gateway := newGatewayWithClient(fake)
	ctx := context.Background()

	// First pairing call blocks until the first code arrives.
	done := make(chan struct{})
	var first pairingResponse
	go func() {
		var err error
		first, err = gateway.Pair(ctx, "tenant-1")
		close(done)
		_ = err
	}()

	// Serve the first QR code with a 10s library timeout (the true expiry).
	fake.channel <- whatsmeow.QRChannelItem{Event: whatsmeow.QRChannelEventCode, Code: "code-first", Timeout: 10 * time.Second}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for first pairing code")
	}
	if first.PairingCode != "code-first" {
		t.Fatalf("expected first code code-first, got %q", first.PairingCode)
	}
	// True expiry comes from item.Timeout, not a hardcoded constant.
	expectedExpiry := time.Now().Add(10 * time.Second)
	if first.ExpiresAt.Before(expectedExpiry.Add(-time.Second)) || first.ExpiresAt.After(expectedExpiry.Add(time.Second)) {
		t.Fatalf("expected expiry ~+10s from library timeout, got %v", first.ExpiresAt)
	}
	if fake.qrCalls != 1 {
		t.Fatalf("expected GetQRChannel called once, got %d", fake.qrCalls)
	}

	// Repeated pairing call returns the rotated code and its true expiry.
	fake.channel <- whatsmeow.QRChannelItem{Event: whatsmeow.QRChannelEventCode, Code: "code-rotated", Timeout: 20 * time.Second}
	// Wait for the drain goroutine to apply the rotation so the current code is deterministic.
	session := qrSessionFor(gateway, "tenant-1")
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		session.mu.Lock()
		rotated := session.code == "code-rotated"
		session.mu.Unlock()
		if rotated {
			break
		}
		time.Sleep(time.Millisecond)
	}
	second, err := gateway.Pair(ctx, "tenant-1")
	if err != nil {
		t.Fatalf("unexpected error for rotated code: %v", err)
	}
	if second.PairingCode != "code-rotated" {
		t.Fatalf("expected rotated code code-rotated, got %q", second.PairingCode)
	}
	expectedExpiry = time.Now().Add(20 * time.Second)
	if second.ExpiresAt.Before(expectedExpiry.Add(-time.Second)) || second.ExpiresAt.After(expectedExpiry.Add(time.Second)) {
		t.Fatalf("expected expiry ~+20s from library timeout, got %v", second.ExpiresAt)
	}
}

func TestPairingStreamSurvivesInitialRequestCancellation(t *testing.T) {
	fake := newFakePairingClient()
	defer close(fake.channel)
	gateway := newGatewayWithClient(fake)
	defer gateway.close()

	requestCtx, cancelRequest := context.WithCancel(context.Background())
	done := make(chan struct{})
	var first pairingResponse
	var firstErr error
	go func() {
		first, firstErr = gateway.Pair(requestCtx, "tenant-1")
		close(done)
	}()
	fake.channel <- whatsmeow.QRChannelItem{Event: whatsmeow.QRChannelEventCode, Code: "code-first", Timeout: 10 * time.Second}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for first pairing code")
	}
	if firstErr != nil || first.PairingCode != "code-first" {
		t.Fatalf("unexpected first pairing result: response=%+v error=%v", first, firstErr)
	}

	// A real HTTP handler cancels its request context after sending the first
	// response. The Whatsmeow channel must remain alive independently.
	cancelRequest()
	fake.channel <- whatsmeow.QRChannelItem{Event: whatsmeow.QRChannelEventCode, Code: "code-rotated", Timeout: 20 * time.Second}

	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		session := qrSessionFor(gateway, "tenant-1")
		if session != nil {
			session.mu.Lock()
			rotated := session.code == "code-rotated"
			session.mu.Unlock()
			if rotated {
				break
			}
		}
		time.Sleep(time.Millisecond)
	}
	second, err := gateway.Pair(context.Background(), "tenant-1")
	if err != nil {
		t.Fatalf("expected rotated code after request cancellation, got %v", err)
	}
	if second.PairingCode != "code-rotated" {
		t.Fatalf("expected rotated code, got %q", second.PairingCode)
	}
	if fake.qrCalls != 1 {
		t.Fatalf("expected one QR channel for the active pairing, got %d", fake.qrCalls)
	}
}

func TestPairWaitsForFreshCodeInsteadOfReturningExpiredCode(t *testing.T) {
	fake := newFakePairingClient()
	defer close(fake.channel)
	gateway := newGatewayWithClient(fake)
	defer gateway.close()

	firstResult := make(chan pairingResponse, 1)
	firstError := make(chan error, 1)
	go func() {
		response, err := gateway.Pair(context.Background(), "tenant-1")
		firstResult <- response
		firstError <- err
	}()
	fake.channel <- whatsmeow.QRChannelItem{Event: whatsmeow.QRChannelEventCode, Code: "code-old", Timeout: 10 * time.Second}
	first := <-firstResult
	if err := <-firstError; err != nil || first.PairingCode != "code-old" {
		t.Fatalf("unexpected first QR response: response=%+v error=%v", first, err)
	}

	session := qrSessionFor(gateway, "tenant-1")
	session.mu.Lock()
	session.expiresAt = time.Now().Add(100 * time.Millisecond)
	session.mu.Unlock()
	secondResult := make(chan pairingResponse, 1)
	secondError := make(chan error, 1)
	go func() {
		response, err := gateway.Pair(context.Background(), "tenant-1")
		secondResult <- response
		secondError <- err
	}()

	time.Sleep(150 * time.Millisecond)
	select {
	case response := <-secondResult:
		t.Fatalf("returned stale code before rotation: %+v", response)
	default:
	}
	fake.channel <- whatsmeow.QRChannelItem{Event: whatsmeow.QRChannelEventCode, Code: "code-new", Timeout: 20 * time.Second}
	select {
	case response := <-secondResult:
		if err := <-secondError; err != nil {
			t.Fatalf("unexpected error after QR rotation: %v", err)
		}
		if response.PairingCode != "code-new" {
			t.Fatalf("expected fresh code code-new, got %q", response.PairingCode)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for the fresh QR code")
	}
}

func TestConcurrentClientLookupCreatesOneDevicePerTenant(t *testing.T) {
	fake := newFakePairingClient()
	var createCalls int
	gateway := &whatsmeowGateway{
		clients:    make(map[string]whatsAppClient),
		qrSessions: make(map[string]*qrSession),
		newClient: func() whatsAppClient {
			createCalls++
			return fake
		},
	}

	const lookups = 20
	results := make(chan whatsAppClient, lookups)
	var lookupsDone sync.WaitGroup
	lookupsDone.Add(lookups)
	for range lookups {
		go func() {
			defer lookupsDone.Done()
			client, err := gateway.client(context.Background(), "tenant-1")
			if err != nil {
				t.Errorf("unexpected client lookup error: %v", err)
				return
			}
			results <- client
		}()
	}
	lookupsDone.Wait()
	close(results)

	if createCalls != 1 {
		t.Fatalf("expected one device client for tenant, got %d", createCalls)
	}
	for client := range results {
		if client != fake {
			t.Fatal("concurrent lookup returned a different client for the tenant")
		}
	}
}

func TestPairErrorOnFinalState(t *testing.T) {
	fake := newFakePairingClient()
	defer close(fake.channel)
	gateway := newGatewayWithClient(fake)
	ctx := context.Background()

	done := make(chan struct{})
	var resp pairingResponse
	go func() {
		resp, _ = gateway.Pair(ctx, "tenant-1")
		close(done)
	}()

	fake.channel <- whatsmeow.QRChannelItem{Event: whatsmeow.QRChannelEventError, Error: context.Canceled}
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for pairing error")
	}
	if resp.PairingCode != "" {
		t.Fatalf("expected empty pairing code on error, got %q", resp.PairingCode)
	}
}

func TestPairAlreadyPaired(t *testing.T) {
	fake := newFakePairingClient()
	defer close(fake.channel)
	fake.setPaired("5511999999999@s.whatsapp.net")
	gateway := newGatewayWithClient(fake)
	ctx := context.Background()

	_, err := gateway.Pair(ctx, "tenant-1")
	if err == nil || err.Error() != "already paired" {
		t.Fatalf("expected 'already paired' error, got %v", err)
	}
}

func TestPairTimeoutWithoutCode(t *testing.T) {
	fake := newFakePairingClient()
	defer close(fake.channel)
	gateway := newGatewayWithClient(fake)
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	_, err := gateway.Pair(ctx, "tenant-1")
	if err == nil || err.Error() != "context deadline exceeded" {
		t.Fatalf("expected context deadline exceeded, got %v", err)
	}
}
