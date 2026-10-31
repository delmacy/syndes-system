package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	waE2E "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"
)

// whatsAppClient is the subset of the Whatsmeow client used by the gateway.
// It is an interface so pairing can be exercised with deterministic fakes
// instead of a real WhatsApp connection.
type whatsAppClient interface {
	AddEventHandler(handler whatsmeow.EventHandler) uint32
	GetQRChannel(context.Context) (<-chan whatsmeow.QRChannelItem, error)
	Connect() error
	Disconnect()
	IsConnected() bool
	IsLoggedIn() bool
	SendMessage(context.Context, types.JID, *waE2E.Message, ...whatsmeow.SendRequestExtra) (whatsmeow.SendResponse, error)
	PairedID() *types.JID
}

// waClient adapts the concrete Whatsmeow client to whatsAppClient.
type waClient struct {
	*whatsmeow.Client
}

func (w *waClient) PairedID() *types.JID {
	return w.Store.ID
}

// qrSession preserves an active Whatsmeow QR channel for the lifetime of a
// pairing attempt, serving the current rotated QR and its true expiry.
type qrSession struct {
	client    whatsAppClient
	tenantID  string
	cancel    context.CancelFunc
	channel   <-chan whatsmeow.QRChannelItem
	mu        sync.Mutex
	code      string
	expiresAt time.Time
	err       error
	changed   chan struct{}
}

func (session *qrSession) signalChangeLocked() {
	close(session.changed)
	session.changed = make(chan struct{})
}

type whatsmeowGateway struct {
	mu         sync.RWMutex
	clientMu   sync.Mutex
	ctx        context.Context
	cancel     context.CancelFunc
	container  *sqlstore.Container
	db         *sql.DB
	callback   *callbackClient
	newClient  func() whatsAppClient
	clients    map[string]whatsAppClient
	qrSessions map[string]*qrSession
}

func newWhatsmeowGateway(ctx context.Context, container *sqlstore.Container, db *sql.DB, callback *callbackClient) *whatsmeowGateway {
	gatewayCtx, cancel := context.WithCancel(ctx)
	return &whatsmeowGateway{
		ctx:        gatewayCtx,
		cancel:     cancel,
		container:  container,
		db:         db,
		callback:   callback,
		clients:    make(map[string]whatsAppClient),
		qrSessions: make(map[string]*qrSession),
	}
}

func (gateway *whatsmeowGateway) restore(ctx context.Context) error {
	rows, err := gateway.db.QueryContext(ctx, `SELECT tenant_id::text, device_jid FROM syndes_whatsapp_tenants`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var tenantID, rawJID string
		if err := rows.Scan(&tenantID, &rawJID); err != nil {
			return err
		}
		jid, err := types.ParseJID(rawJID)
		if err != nil {
			return err
		}
		device, err := gateway.container.GetDevice(ctx, jid)
		if err != nil || device == nil {
			return fmt.Errorf("restore tenant %s: session missing", tenantID)
		}
		raw := whatsmeow.NewClient(device, nil)
		client := &waClient{Client: raw}
		gateway.registerClient(tenantID, client)
		if err := client.Connect(); err != nil {
			slog.Warn("session restore deferred", "tenant_id", tenantID, "error", err.Error())
		}
	}
	return rows.Err()
}

func (gateway *whatsmeowGateway) Pair(ctx context.Context, tenantID string) (pairingResponse, error) {
	client, err := gateway.client(ctx, tenantID)
	if err != nil {
		return pairingResponse{}, err
	}
	if client.PairedID() != nil {
		return pairingResponse{}, errors.New("already paired")
	}

	gateway.mu.Lock()
	session := gateway.qrSessions[tenantID]
	if session == nil {
		// The HTTP request ends as soon as the first code is returned. Bind the
		// QR stream to the gateway lifecycle so it can emit replacement codes.
		pairingCtx, cancel := context.WithCancel(gateway.ctx)
		channel, err := client.GetQRChannel(pairingCtx)
		if err != nil {
			cancel()
			gateway.mu.Unlock()
			return pairingResponse{}, providerError("create QR channel", err)
		}
		if err := client.Connect(); err != nil {
			cancel()
			gateway.mu.Unlock()
			return pairingResponse{}, providerError("pair connect", err)
		}
		session = &qrSession{
			tenantID: tenantID,
			cancel:   cancel,
			client:   client,
			channel:  channel,
			changed:  make(chan struct{}),
		}
		gateway.qrSessions[tenantID] = session
		go gateway.drain(session)
	}
	gateway.mu.Unlock()

	timer := time.NewTimer(pairingTimeout)
	defer timer.Stop()
	for {
		session.mu.Lock()
		code := session.code
		expiresAt := session.expiresAt
		sessionErr := session.err
		changed := session.changed
		session.mu.Unlock()

		if sessionErr != nil {
			return pairingResponse{}, sessionErr
		}
		// If the browser asks right at expiry, wait for whatsmeow's next
		// channel event instead of returning a QR that is about to expire.
		if code != "" && time.Until(expiresAt) > pairingRefreshSkew {
			return pairingResponse{PairingCode: code, ExpiresAt: expiresAt}, nil
		}

		select {
		case <-changed:
		case <-ctx.Done():
			return pairingResponse{}, ctx.Err()
		case <-timer.C:
			return pairingResponse{}, errors.New("pairing timeout")
		}
	}
}

// pairingTimeout bounds how long Pair waits for the first QR code.
const pairingTimeout = 15 * time.Second
const pairingRefreshSkew = time.Second

// drain consumes the QR channel and keeps the session's current code and true
// expiry up to date as codes rotate. It runs for the lifetime of the pairing
// attempt and terminates when the channel reaches a final state.
func (gateway *whatsmeowGateway) drain(session *qrSession) {
	defer func() {
		session.mu.Lock()
		session.code = ""
		if session.err == nil {
			session.err = errors.New("pairing channel closed")
		}
		session.signalChangeLocked()
		session.mu.Unlock()
		session.cancel()

		gateway.mu.Lock()
		if gateway.qrSessions[session.tenantID] == session {
			delete(gateway.qrSessions, session.tenantID)
		}
		gateway.mu.Unlock()
	}()
	for item := range session.channel {
		switch item.Event {
		case whatsmeow.QRChannelEventCode:
			session.mu.Lock()
			session.code = item.Code
			session.expiresAt = time.Now().Add(item.Timeout)
			session.signalChangeLocked()
			session.mu.Unlock()
		case whatsmeow.QRChannelEventError:
			session.mu.Lock()
			session.err = item.Error
			session.signalChangeLocked()
			session.mu.Unlock()
			return
		default:
			session.mu.Lock()
			session.err = fmt.Errorf("pairing finished: %s", item.Event)
			session.signalChangeLocked()
			session.mu.Unlock()
			return
		}
	}
}

func (gateway *whatsmeowGateway) Connect(ctx context.Context, tenantID string) (connectResponse, error) {
	client, err := gateway.client(ctx, tenantID)
	if err != nil {
		return connectResponse{}, err
	}
	if !client.IsConnected() {
		if err := client.Connect(); err != nil {
			return connectResponse{}, providerError("connect", err)
		}
	}
	if client.PairedID() == nil {
		return connectResponse{}, errors.New("pairing not complete")
	}
	if err := gateway.saveMapping(ctx, tenantID, client.PairedID().String()); err != nil {
		return connectResponse{}, err
	}
	gateway.mu.Lock()
	session := gateway.qrSessions[tenantID]
	delete(gateway.qrSessions, tenantID)
	gateway.mu.Unlock()
	if session != nil {
		session.cancel()
	}
	return connectResponse{PhoneExternalID: client.PairedID().String()}, nil
}

func (gateway *whatsmeowGateway) Disconnect(ctx context.Context, tenantID string) error {
	client, err := gateway.client(ctx, tenantID)
	if err != nil {
		return err
	}
	gateway.mu.Lock()
	session := gateway.qrSessions[tenantID]
	delete(gateway.clients, tenantID)
	delete(gateway.qrSessions, tenantID)
	gateway.mu.Unlock()
	if session != nil {
		session.cancel()
	}
	client.Disconnect()
	return nil
}

func (gateway *whatsmeowGateway) close() {
	gateway.cancel()
	gateway.mu.Lock()
	defer gateway.mu.Unlock()
	for _, session := range gateway.qrSessions {
		session.cancel()
	}
	for tenantID, client := range gateway.clients {
		client.Disconnect()
		delete(gateway.clients, tenantID)
		delete(gateway.qrSessions, tenantID)
	}
}

func (gateway *whatsmeowGateway) Send(ctx context.Context, tenantID string, input sendRequest) (sendResponse, error) {
	client, err := gateway.client(ctx, tenantID)
	if err != nil {
		return sendResponse{}, err
	}
	if !client.IsConnected() || !client.IsLoggedIn() {
		return sendResponse{}, errors.New("not connected")
	}
	recipient, err := parseRecipient(input.RecipientExternalID)
	if err != nil {
		return sendResponse{}, err
	}
	response, err := client.SendMessage(ctx, recipient, &waE2E.Message{Conversation: proto.String(input.Body)})
	if err != nil {
		return sendResponse{}, providerError("send", err)
	}
	return sendResponse{ExternalMessageID: response.ID}, nil
}

func (gateway *whatsmeowGateway) client(ctx context.Context, tenantID string) (whatsAppClient, error) {
	// Keep lazy client creation atomic. Otherwise simultaneous pairing requests
	// can each create a different device and leave the active QR on a client that
	// is no longer selected by this tenant for the subsequent connect request.
	gateway.clientMu.Lock()
	defer gateway.clientMu.Unlock()

	gateway.mu.RLock()
	client := gateway.clients[tenantID]
	gateway.mu.RUnlock()
	if client != nil {
		return client, nil
	}
	if gateway.newClient != nil {
		client = gateway.newClient()
	} else {
		device := gateway.container.NewDevice()
		raw := whatsmeow.NewClient(device, nil)
		client = &waClient{Client: raw}
	}
	gateway.registerClient(tenantID, client)
	return client, nil
}

func (gateway *whatsmeowGateway) registerClient(tenantID string, client whatsAppClient) {
	client.AddEventHandler(func(raw any) {
		switch event := raw.(type) {
		case *events.Connected:
			if client.PairedID() != nil {
				_ = gateway.saveMapping(context.Background(), tenantID, client.PairedID().String())
			}
		case *events.Message:
			if event.Info.IsFromMe || event.Info.IsGroup || event.Info.Chat.Server == types.NewsletterServer {
				return
			}
			body := messageText(event.Message)
			if body == "" {
				return
			}
			go gateway.enqueueInbound(context.Background(), tenantID, inboundEvent{
				ExternalMessageID: event.Info.ID,
				SenderExternalID:  event.Info.Sender.String(),
				Body:              body,
				OccurredAt:        event.Info.Timestamp.UTC().Format(time.RFC3339Nano),
			})
		}
	})
	gateway.mu.Lock()
	gateway.clients[tenantID] = client
	gateway.mu.Unlock()
}

func (gateway *whatsmeowGateway) saveMapping(ctx context.Context, tenantID, jid string) error {
	_, err := gateway.db.ExecContext(ctx, `INSERT INTO syndes_whatsapp_tenants (tenant_id, device_jid, updated_at)
		VALUES ($1, $2, now()) ON CONFLICT (tenant_id) DO UPDATE SET device_jid = EXCLUDED.device_jid, updated_at = now()`, tenantID, jid)
	return err
}

func (gateway *whatsmeowGateway) enqueueInbound(ctx context.Context, tenantID string, event inboundEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		slog.Error("failed to encode inbound event", "tenant_id", tenantID, "external_message_id", event.ExternalMessageID, "error", err.Error())
		return
	}
	_, err = gateway.db.ExecContext(ctx, `INSERT INTO syndes_whatsapp_inbound_outbox
		(tenant_id, external_message_id, payload) VALUES ($1, $2, $3)
		ON CONFLICT (tenant_id, external_message_id) DO NOTHING`, tenantID, event.ExternalMessageID, payload)
	if err != nil {
		slog.Error("failed to persist inbound event", "tenant_id", tenantID, "external_message_id", event.ExternalMessageID, "error", err.Error())
	}
}

func (gateway *whatsmeowGateway) startInboundDispatcher(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			gateway.deliverPending(ctx)
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
}

func (gateway *whatsmeowGateway) deliverPending(ctx context.Context) {
	rows, err := gateway.db.QueryContext(ctx, `SELECT id, tenant_id::text, payload, attempts
		FROM syndes_whatsapp_inbound_outbox WHERE next_attempt_at <= now()
		ORDER BY id LIMIT 50`)
	if err != nil {
		if !errors.Is(err, context.Canceled) {
			slog.Error("failed to read inbound outbox", "error", err.Error())
		}
		return
	}
	type pending struct {
		id       int64
		tenantID string
		payload  []byte
		attempts int
	}
	items := make([]pending, 0, 50)
	for rows.Next() {
		var item pending
		if err := rows.Scan(&item.id, &item.tenantID, &item.payload, &item.attempts); err != nil {
			slog.Error("failed to scan inbound outbox", "error", err.Error())
			continue
		}
		items = append(items, item)
	}
	_ = rows.Close()
	for _, item := range items {
		var event inboundEvent
		if err := json.Unmarshal(item.payload, &event); err != nil {
			_, _ = gateway.db.ExecContext(ctx, `UPDATE syndes_whatsapp_inbound_outbox SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + interval '1 hour' WHERE id = $1`, item.id, "invalid persisted payload")
			continue
		}
		if err := gateway.callback.deliver(ctx, item.tenantID, event); err == nil {
			_, _ = gateway.db.ExecContext(ctx, `DELETE FROM syndes_whatsapp_inbound_outbox WHERE id = $1`, item.id)
		} else {
			delaySeconds := 1 << min(item.attempts, 8)
			_, updateErr := gateway.db.ExecContext(ctx, `UPDATE syndes_whatsapp_inbound_outbox
				SET attempts = attempts + 1, last_error = $2, next_attempt_at = now() + ($3 * interval '1 second') WHERE id = $1`, item.id, err.Error(), delaySeconds)
			if updateErr != nil && !errors.Is(updateErr, context.Canceled) {
				slog.Error("failed to reschedule inbound event", "outbox_id", item.id, "error", updateErr.Error())
			}
		}
	}
}

func parseRecipient(raw string) (types.JID, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return types.EmptyJID, errors.New("recipient required")
	}
	if !strings.Contains(value, "@") {
		value = strings.TrimPrefix(value, "+") + "@s.whatsapp.net"
	}
	return types.ParseJID(value)
}

func messageText(message *waE2E.Message) string {
	if message == nil {
		return ""
	}
	if text := message.GetConversation(); text != "" {
		return text
	}
	if extended := message.GetExtendedTextMessage(); extended != nil {
		return extended.GetText()
	}
	return ""
}

type inboundEvent struct {
	ExternalMessageID string `json:"externalMessageId"`
	SenderExternalID  string `json:"senderExternalId"`
	Body              string `json:"body"`
	OccurredAt        string `json:"occurredAt"`
}

type callbackClient struct {
	baseURL string
	token   string
	client  *http.Client
}

func (callback *callbackClient) deliver(ctx context.Context, tenantID string, event inboundEvent) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}
	var lastErr error
	for attempt := 0; attempt < 3; attempt++ {
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, callback.baseURL+"/api/v1/internal/whatsapp/events/"+tenantID, bytes.NewReader(payload))
		if err != nil {
			return err
		}
		request.Header.Set("Authorization", "Bearer "+callback.token)
		request.Header.Set("Content-Type", "application/json")
		response, err := callback.client.Do(request)
		if err == nil {
			_ = response.Body.Close()
			if response.StatusCode >= 200 && response.StatusCode < 300 {
				return nil
			}
			lastErr = fmt.Errorf("callback status %d", response.StatusCode)
		} else {
			lastErr = err
		}
		if attempt < 2 {
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(time.Duration(100*(1<<attempt)) * time.Millisecond):
			}
		}
	}
	return lastErr
}
