package main

import (
	"context"
 "crypto/hmac"
 "crypto/sha256"
 "encoding/hex"
 "crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
	"go.mau.fi/whatsmeow/store/sqlstore"
)

type config struct {
	bindAddress  string
	storeDSN     string
	apiBaseURL   string
	serviceToken string
	webhookToken string
}

func loadConfig() (config, error) {
	cfg := config{
		bindAddress:  envOr("WHATSAPP_SIDECAR_BIND", "127.0.0.1:19083"),
		storeDSN:     strings.TrimSpace(os.Getenv("WHATSAPP_STORE_DSN")),
		apiBaseURL:   strings.TrimRight(strings.TrimSpace(os.Getenv("SYNDES_API_URL")), "/"),
		serviceToken: strings.TrimSpace(os.Getenv("WHATSAPP_WHATSMEOW_TOKEN")),
		webhookToken: strings.TrimSpace(os.Getenv("WHATSAPP_WEBHOOK_TOKEN")),
	}
	if cfg.storeDSN == "" || cfg.apiBaseURL == "" || cfg.serviceToken == "" || cfg.webhookToken == "" {
		return config{}, errors.New("WHATSAPP_STORE_DSN, SYNDES_API_URL, WHATSAPP_WHATSMEOW_TOKEN and WHATSAPP_WEBHOOK_TOKEN are required")
	}
	return cfg, nil
}

func envOr(name, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(name)); value != "" {
		return value
	}
	return fallback
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		slog.Error("invalid sidecar configuration", "error", err.Error())
		os.Exit(1)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	db, err := sql.Open("pgx", cfg.storeDSN)
	if err != nil {
		slog.Error("failed to open session store", "error", err.Error())
		os.Exit(1)
	}
	defer db.Close()
	container := sqlstore.NewWithDB(db, "postgres", nil)
	if err := container.Upgrade(ctx); err != nil {
		slog.Error("failed to migrate session store", "error", err.Error())
		os.Exit(1)
	}
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS syndes_whatsapp_accounts (
  account_id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  device_jid text UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
 );
 `); err != nil {
  slog.Error("failed to migrate account registry", "error", err.Error())
  os.Exit(1)
 }
 // Preserve original tenant-only sessions when upgrading existing installations.
 var legacyExists bool
 if err := db.QueryRowContext(ctx, `SELECT to_regclass('syndes_whatsapp_tenants') IS NOT NULL`).Scan(&legacyExists); err != nil {
  slog.Error("failed to detect legacy sessions", "error", err.Error()); os.Exit(1)
 }
 if legacyExists {
  if _, err := db.ExecContext(ctx, `INSERT INTO syndes_whatsapp_accounts(account_id,tenant_id,device_jid)
  SELECT tenant_id,tenant_id,device_jid FROM syndes_whatsapp_tenants
  ON CONFLICT(account_id) DO NOTHING`); err != nil {
   slog.Error("failed to migrate legacy sessions", "error", err.Error()); os.Exit(1)
  }
 }
 if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS syndes_whatsapp_inbound_outbox (
  id bigserial PRIMARY KEY,
  tenant_id uuid NOT NULL,
  account_id uuid,
  external_message_id text NOT NULL,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
 );
 ALTER TABLE syndes_whatsapp_inbound_outbox ADD COLUMN IF NOT EXISTS account_id uuid;
 CREATE UNIQUE INDEX IF NOT EXISTS syndes_whatsapp_inbound_account_message_idx
 ON syndes_whatsapp_inbound_outbox(account_id,external_message_id);`); err != nil {
  slog.Error("failed to migrate inbound outbox", "error", err.Error())
  os.Exit(1)
 }

	callback := &callbackClient{
		baseURL: cfg.apiBaseURL,
		token:   cfg.webhookToken,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
	gateway := newWhatsmeowGateway(container, db, callback)
	if err := migrateOutbound(ctx,db); err != nil { slog.Error("failed to migrate outbound", "error",err.Error());os.Exit(1) }
 gateway.startInboundDispatcher(ctx)
 gateway.startOutboundDispatcher(ctx)
	if err := gateway.restore(ctx); err != nil {
		slog.Error("failed to restore sessions", "error", err.Error())
		os.Exit(1)
	}

	handler := newAccountHTTPHandler(gateway, cfg.serviceToken, db)
	server := &http.Server{Addr: cfg.bindAddress, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	slog.Info("whatsmeow sidecar listening", "address", cfg.bindAddress)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("sidecar stopped unexpectedly", "error", err.Error())
		os.Exit(1)
	}
}

type gateway interface {
	Pair(context.Context, string) (pairingResponse, error)
	Connect(context.Context, string) (connectResponse, error)
	Disconnect(context.Context, string) error
	Send(context.Context, string, sendRequest) (sendResponse, error)
}

type pairingResponse struct {
	PairingCode string    `json:"pairingCode"`
	ExpiresAt   time.Time `json:"expiresAt"`
}

type connectResponse struct {
	PhoneExternalID string `json:"phoneExternalId"`
}

type sendRequest struct {
	RecipientExternalID string `json:"recipientExternalId"`
	Body                string `json:"body"`
 IdempotencyKey string `json:"idempotencyKey"`
}

type sendResponse struct {
	ExternalMessageID string `json:"externalMessageId,omitempty"`
 QueueID int64 `json:"queueId,omitempty"`
}

func newHTTPHandler(gateway gateway, token string) http.Handler {
 return newAccountHTTPHandler(gateway, token, nil)
}

func newAccountHTTPHandler(gateway gateway, token string, db *sql.DB) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /v1/accounts/{accountId}/{operation}", func(writer http.ResponseWriter, request *http.Request) {
		if db == nil || !authorizeAccount(request.Context(),db,accountFromRequest(request),request.Header.Get("Authorization"),token) {
			writeJSON(writer, http.StatusUnauthorized, map[string]string{"code": "unauthorized"})
			return
		}
		accountID := request.PathValue("accountId")
		if !validUUID(accountID) {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"code": "invalid_account"})
			return
		}
		var response any
		var err error
		switch request.PathValue("operation") {
		case "pairing":
			response, err = gateway.Pair(request.Context(), accountID)
		case "connect":
			response, err = gateway.Connect(request.Context(), accountID)
		case "disconnect":
			err = gateway.Disconnect(request.Context(), accountID)
			if err == nil {
				writer.WriteHeader(http.StatusNoContent)
				return
			}
		case "messages":
			var input sendRequest
			decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 16*1024))
			decoder.DisallowUnknownFields()
			if decodeErr := decoder.Decode(&input); decodeErr != nil || input.Body == "" || len(input.Body) > 10000 || input.IdempotencyKey == "" {
				writeJSON(writer, http.StatusBadRequest, map[string]string{"code": "invalid_request"})
				return
			}
			response, err = gateway.Send(request.Context(), accountID, input)
		default:
			writeJSON(writer, http.StatusNotFound, map[string]string{"code": "not_found"})
			return
		}
		if err != nil {
			slog.Warn("whatsmeow operation failed", "operation", request.PathValue("operation"), "account_id", accountID, "error", err.Error())
			writeJSON(writer, http.StatusBadGateway, map[string]string{"code": "provider_error"})
			return
		}
		writeJSON(writer, http.StatusOK, response)
	})
	return mux
}

// A per-account token is derived by the trusted Core Host. Neither the tenant
// nor the account selector in the URL grants any authority by itself.
func accountFromRequest(request *http.Request) string { return request.PathValue("accountId") }

func accountToken(master, tenantID, accountID string) string {
 mac := hmac.New(sha256.New, []byte(master))
 _, _ = mac.Write([]byte("syndes-whatsapp-v1:" + tenantID + ":" + accountID))
 return hex.EncodeToString(mac.Sum(nil))
}

func authorizeAccount(ctx context.Context,db *sql.DB,accountID,header,master string) bool {
 if db == nil || !validUUID(accountID) || master == "" { return false }
 var tenantID string
 if err := db.QueryRowContext(ctx,`SELECT tenant_id::text FROM syndes_whatsapp_accounts
 WHERE account_id=$1 AND enabled=true`,accountID).Scan(&tenantID); err != nil { return false }
 const prefix="Bearer "
 if !strings.HasPrefix(header,prefix) { return false }
 provided:=strings.TrimPrefix(header,prefix)
 expected:=accountToken(master,tenantID,accountID)
 return subtle.ConstantTimeCompare([]byte(provided),[]byte(expected))==1
}

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func validUUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for index, character := range value {
		if index == 8 || index == 13 || index == 18 || index == 23 {
			if character != '-' {
				return false
			}
			continue
		}
		if !strings.ContainsRune("0123456789abcdefABCDEF", character) {
			return false
		}
	}
	return true
}

func constantTimeBearer(header, token string) bool {
	actual := strings.TrimPrefix(header, "Bearer ")
	if actual == header || token == "" || len(actual) != len(token) {
		return false
	}
	var difference byte
	for index := range token {
		difference |= actual[index] ^ token[index]
	}
	return difference == 0
}

func providerError(operation string, err error) error {
	return fmt.Errorf("%s: %w", operation, err)
}
