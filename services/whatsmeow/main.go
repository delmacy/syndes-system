package main

import (
	"context"
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
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS syndes_whatsapp_tenants (
		tenant_id uuid PRIMARY KEY,
		device_jid text UNIQUE NOT NULL,
		updated_at timestamptz NOT NULL DEFAULT now()
	)`); err != nil {
		slog.Error("failed to migrate tenant session map", "error", err.Error())
		os.Exit(1)
	}
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS syndes_whatsapp_inbound_outbox (
		id bigserial PRIMARY KEY,
		tenant_id uuid NOT NULL,
		external_message_id text NOT NULL,
		payload jsonb NOT NULL,
		attempts integer NOT NULL DEFAULT 0,
		next_attempt_at timestamptz NOT NULL DEFAULT now(),
		last_error text,
		created_at timestamptz NOT NULL DEFAULT now(),
		UNIQUE (tenant_id, external_message_id)
	)`); err != nil {
		slog.Error("failed to migrate inbound outbox", "error", err.Error())
		os.Exit(1)
	}

	callback := &callbackClient{
		baseURL: cfg.apiBaseURL,
		token:   cfg.webhookToken,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
	gateway := newWhatsmeowGateway(ctx, container, db, callback)
	gateway.startInboundDispatcher(ctx)
	if err := gateway.restore(ctx); err != nil {
		slog.Error("failed to restore sessions", "error", err.Error())
		os.Exit(1)
	}

	handler := newHTTPHandler(gateway, cfg.serviceToken)
	server := &http.Server{Addr: cfg.bindAddress, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()
		_ = server.Shutdown(shutdownCtx)
		gateway.close()
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
}

type sendResponse struct {
	ExternalMessageID string `json:"externalMessageId"`
}

func newHTTPHandler(gateway gateway, token string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(writer http.ResponseWriter, _ *http.Request) {
		writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /v1/tenants/{tenantId}/{operation}", func(writer http.ResponseWriter, request *http.Request) {
		if !constantTimeBearer(request.Header.Get("Authorization"), token) {
			writeJSON(writer, http.StatusUnauthorized, map[string]string{"code": "unauthorized"})
			return
		}
		tenantID := request.PathValue("tenantId")
		if !validUUID(tenantID) {
			writeJSON(writer, http.StatusBadRequest, map[string]string{"code": "invalid_tenant"})
			return
		}
		var response any
		var err error
		switch request.PathValue("operation") {
		case "pairing":
			response, err = gateway.Pair(request.Context(), tenantID)
		case "connect":
			response, err = gateway.Connect(request.Context(), tenantID)
		case "disconnect":
			err = gateway.Disconnect(request.Context(), tenantID)
			if err == nil {
				writer.WriteHeader(http.StatusNoContent)
				return
			}
		case "messages":
			var input sendRequest
			decoder := json.NewDecoder(http.MaxBytesReader(writer, request.Body, 16*1024))
			decoder.DisallowUnknownFields()
			if decodeErr := decoder.Decode(&input); decodeErr != nil || input.Body == "" || len(input.Body) > 10000 {
				writeJSON(writer, http.StatusBadRequest, map[string]string{"code": "invalid_request"})
				return
			}
			response, err = gateway.Send(request.Context(), tenantID, input)
		default:
			writeJSON(writer, http.StatusNotFound, map[string]string{"code": "not_found"})
			return
		}
		if err != nil {
			slog.Warn("whatsmeow operation failed", "operation", request.PathValue("operation"), "tenant_id", tenantID, "error", err.Error())
			writeJSON(writer, http.StatusBadGateway, map[string]string{"code": "provider_error"})
			return
		}
		writeJSON(writer, http.StatusOK, response)
	})
	return mux
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
