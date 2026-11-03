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

type whatsmeowGateway struct {
	mu         sync.RWMutex
	container  *sqlstore.Container
	db         *sql.DB
	callback   *callbackClient
	clients    map[string]*whatsmeow.Client
	qrMu       sync.Mutex
	qrSessions map[string]*qrSession
}

func newWhatsmeowGateway(container *sqlstore.Container, db *sql.DB, callback *callbackClient) *whatsmeowGateway {
	return &whatsmeowGateway{container: container, db: db, callback: callback, clients: make(map[string]*whatsmeow.Client), qrSessions: make(map[string]*qrSession)}
}

func (gateway *whatsmeowGateway) restore(ctx context.Context) error {
	rows, err := gateway.db.QueryContext(ctx, `SELECT account_id::text, tenant_id::text, device_jid FROM syndes_whatsapp_accounts WHERE device_jid IS NOT NULL AND enabled=true`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var accountID, tenantID, rawJID string
		if err := rows.Scan(&accountID, &tenantID, &rawJID); err != nil {
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
		client := whatsmeow.NewClient(device, nil)
		gateway.registerClient(accountID, tenantID, client)
		if err := client.Connect(); err != nil {
			slog.Warn("session restore deferred", "tenant_id", tenantID, "error", err.Error())
		}
	}
	return rows.Err()
}

// qrSession owns the WhatsApp QR stream independently of the HTTP request that
// started it. In whatsmeow, cancelling GetQRChannel's context disconnects the
// client, so the request context MUST NOT be passed to GetQRChannel.
type qrSession struct {
	mu        sync.RWMutex
	code      string
	expiresAt time.Time
	finished  bool
	failure   error
	changed   chan struct{}
	cancel    context.CancelFunc
}

func newQRSession(cancel context.CancelFunc) *qrSession {
	return &qrSession{changed: make(chan struct{}), cancel: cancel}
}

func (session *qrSession) publish(code string, ttl time.Duration) {
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.finished {
		return
	}
	session.code = code
	session.expiresAt = time.Now().Add(ttl)
	close(session.changed)
	session.changed = make(chan struct{})
}

func (session *qrSession) finish(err error) {
	session.mu.Lock()
	defer session.mu.Unlock()
	if session.finished {
		return
	}
	session.finished = true
	session.failure = err
	close(session.changed)
}

func (session *qrSession) latest(ctx context.Context) (pairingResponse, error) {
	wait := time.NewTimer(15 * time.Second)
	defer wait.Stop()
	for {
		session.mu.RLock()
		code, expiry, finished, failure, changed := session.code, session.expiresAt, session.finished, session.failure, session.changed
		session.mu.RUnlock()
		if code != "" && time.Until(expiry) > 2*time.Second && !finished {
			return pairingResponse{PairingCode: code, ExpiresAt: expiry}, nil
		}
		if finished {
			if failure == nil {
				failure = errors.New("pairing session ended")
			}
			return pairingResponse{}, failure
		}
		select {
		case <-changed:
		case <-ctx.Done():
			return pairingResponse{}, ctx.Err()
		case <-wait.C:
			return pairingResponse{}, errors.New("pairing QR unavailable")
		}
	}
}

func (gateway *whatsmeowGateway) consumeQR(accountID string, session *qrSession, ch <-chan whatsmeow.QRChannelItem) {
	var failure error
	for item := range ch {
		if item.Event == whatsmeow.QRChannelEventCode && item.Code != "" {
			session.publish(item.Code, item.Timeout)
			continue
		}
		if item.Event == whatsmeow.QRChannelEventError && item.Error != nil {
			failure = item.Error
			break
		}
		if item.Event == whatsmeow.QRChannelSuccess.Event {
			failure = errors.New("already paired")
			break
		}
		failure = fmt.Errorf("pairing event %s", item.Event)
		break
	}
	session.finish(failure)
	session.cancel()
	gateway.qrMu.Lock()
	if gateway.qrSessions[accountID] == session {
		delete(gateway.qrSessions, accountID)
	}
	gateway.qrMu.Unlock()
}

func (gateway *whatsmeowGateway) stopQR(accountID string) {
	gateway.qrMu.Lock()
	session := gateway.qrSessions[accountID]
	delete(gateway.qrSessions, accountID)
	gateway.qrMu.Unlock()
	if session != nil {
		session.finish(errors.New("pairing canceled"))
		session.cancel()
	}
}

func (gateway *whatsmeowGateway) Pair(ctx context.Context, accountID string) (pairingResponse, error) {
	client, err := gateway.client(ctx, accountID)
	if err != nil {
		return pairingResponse{}, err
	}
	if client.Store.ID != nil {
		return pairingResponse{}, errors.New("already paired")
	}
	gateway.qrMu.Lock()
	if session := gateway.qrSessions[accountID]; session != nil {
		gateway.qrMu.Unlock()
		return session.latest(ctx)
	}
	// Reinitialize only if the previous QR session has ended, never while
	// another pairing request is still active for this account.
	if client.IsConnected() {
		client.Disconnect()
	}
	sessionCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	ch, err := client.GetQRChannel(sessionCtx)
	if err != nil {
		cancel()
		gateway.qrMu.Unlock()
		return pairingResponse{}, providerError("create QR channel", err)
	}
	session := newQRSession(cancel)
	gateway.qrSessions[accountID] = session
	go gateway.consumeQR(accountID, session, ch)
	err = client.Connect()
	if err != nil {
		delete(gateway.qrSessions, accountID)
		session.finish(err)
		cancel()
		gateway.qrMu.Unlock()
		return pairingResponse{}, providerError("pair connect", err)
	}
	gateway.qrMu.Unlock()
	return session.latest(ctx)
}

func (gateway *whatsmeowGateway) Connect(ctx context.Context, accountID string) (connectResponse, error) {
	client, err := gateway.client(ctx, accountID)
	if err != nil {
		return connectResponse{}, err
	}
	if !client.IsConnected() {
		if err := client.Connect(); err != nil {
			return connectResponse{}, providerError("connect", err)
		}
	}
	if client.Store.ID == nil {
		return connectResponse{}, errors.New("pairing not complete")
	}
	if err := gateway.saveMapping(ctx, accountID, client.Store.ID.String()); err != nil {
		return connectResponse{}, err
	}
	return connectResponse{PhoneExternalID: client.Store.ID.String()}, nil
}

// Pause stops an already registered client after the gateway registry is disabled.
func (gateway *whatsmeowGateway) Pause(accountID string) {
	gateway.stopQR(accountID)
	gateway.mu.RLock()
	client := gateway.clients[accountID]
	gateway.mu.RUnlock()
	if client != nil {
		client.Disconnect()
	}
}

func (gateway *whatsmeowGateway) Disconnect(ctx context.Context, accountID string) error {
	gateway.stopQR(accountID)
	client, err := gateway.client(ctx, accountID)
	if err != nil {
		return err
	}
	client.Disconnect()
	return nil
}

func (gateway *whatsmeowGateway) sendDirect(ctx context.Context, accountID string, input sendRequest) (sendResponse, error) {
	client, err := gateway.client(ctx, accountID)
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

// Clients are keyed by account, never by tenant. Account ownership is resolved from
// the gateway's own trusted session registry, not a caller supplied tenant selector.
func (gateway *whatsmeowGateway) client(ctx context.Context, accountID string) (*whatsmeow.Client, error) {
	gateway.mu.RLock()
	client := gateway.clients[accountID]
	gateway.mu.RUnlock()
	var tenantID string
	err := gateway.db.QueryRowContext(ctx, `SELECT tenant_id::text FROM syndes_whatsapp_accounts
 WHERE account_id=$1 AND enabled=true`, accountID).Scan(&tenantID)
	if err != nil {
		return nil, errors.New("account not registered or disabled")
	}
	if client != nil {
		return client, nil
	}
	gateway.mu.Lock()
	defer gateway.mu.Unlock()
	if existing := gateway.clients[accountID]; existing != nil {
		return existing, nil
	}
	device := gateway.container.NewDevice()
	client = whatsmeow.NewClient(device, nil)
	gateway.registerClientHandler(accountID, tenantID, client)
	gateway.clients[accountID] = client
	return client, nil
}

func (gateway *whatsmeowGateway) registerClient(accountID, tenantID string, client *whatsmeow.Client) {
	gateway.mu.Lock()
	defer gateway.mu.Unlock()
	gateway.registerClientHandler(accountID, tenantID, client)
	gateway.clients[accountID] = client
}

func (gateway *whatsmeowGateway) registerClientHandler(accountID, tenantID string, client *whatsmeow.Client) {
	client.AddEventHandler(func(raw any) {
		switch event := raw.(type) {
		case *events.Connected:
			if client.Store.ID != nil {
				_ = gateway.saveMapping(context.Background(), accountID, client.Store.ID.String())
			}
		case *events.Message:
			if event.Info.IsFromMe || event.Info.IsGroup || event.Info.Chat.Server == types.NewsletterServer {
				return
			}
			body := messageText(event.Message)
			if body == "" {
				return
			}
			go gateway.enqueueInbound(context.Background(), tenantID, accountID, inboundEvent{
				AccountID: accountID, ExternalMessageID: event.Info.ID,
				SenderExternalID: event.Info.Sender.String(), Body: body,
				OccurredAt: event.Info.Timestamp.UTC().Format(time.RFC3339Nano),
			})
		}
	})
}

func (gateway *whatsmeowGateway) saveMapping(ctx context.Context, accountID, jid string) error {
	result, err := gateway.db.ExecContext(ctx, `UPDATE syndes_whatsapp_accounts
 SET device_jid=$2, updated_at=now() WHERE account_id=$1 AND enabled=true`, accountID, jid)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count != 1 {
		return errors.New("account not registered or disabled")
	}
	return nil
}

func (gateway *whatsmeowGateway) enqueueInbound(ctx context.Context, tenantID, accountID string, event inboundEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		slog.Error("failed to encode inbound event", "tenant_id", tenantID, "external_message_id", event.ExternalMessageID, "error", err.Error())
		return
	}
	_, err = gateway.db.ExecContext(ctx, `INSERT INTO syndes_whatsapp_inbound_outbox
		(tenant_id, account_id, external_message_id, payload) VALUES ($1, $2, $3, $4)
		ON CONFLICT (account_id, external_message_id) DO NOTHING`, tenantID, accountID, event.ExternalMessageID, payload)
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
	AccountID         string `json:"accountId"`
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
	payload, err := json.Marshal(struct {
		Version   string       `json:"version"`
		Type      string       `json:"type"`
		TenantID  string       `json:"tenantId"`
		AccountID string       `json:"accountId"`
		Message   inboundEvent `json:"message"`
	}{Version: "1", Type: "whatsapp.message.received", TenantID: tenantID, AccountID: event.AccountID, Message: event})
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
		request.Header.Set("X-Syndes-Event-Version", "1")
		request.Header.Set("X-Syndes-Event-Type", "whatsapp.message.received")
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
