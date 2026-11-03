package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
)

type accountRecord struct {
	AccountID string  `json:"accountId"`
	TenantID  string  `json:"tenantId"`
	DeviceJID *string `json:"deviceJid"`
	Enabled   bool    `json:"enabled"`
	Connected bool    `json:"connected"`
}

func tenantToken(master, tenantID string) string {
	return accountToken(master, tenantID, "tenant-registry")
}
func authorizedTenant(header, master, tenantID string) bool {
	if master == "" || !validUUID(tenantID) || !strings.HasPrefix(header, "Bearer ") {
		return false
	}
	token := strings.TrimPrefix(header, "Bearer ")
	return subtle.ConstantTimeCompare([]byte(token), []byte(tenantToken(master, tenantID))) == 1
}
func installAccountRoutes(mux *http.ServeMux, db *sql.DB, provider gateway, master string) {
	mux.HandleFunc("POST /v1/tenants/{tenantId}/accounts/{accountId}/history", func(w http.ResponseWriter, r *http.Request) {
		tenantID, accountID := r.PathValue("tenantId"), r.PathValue("accountId")
		if !authorizedTenant(r.Header.Get("Authorization"), master, tenantID) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"code": "unauthorized"})
			return
		}
		if !validUUID(accountID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_account"})
			return
		}
		var enabled bool
		err := db.QueryRowContext(r.Context(), `SELECT enabled FROM syndes_whatsapp_accounts
            WHERE tenant_id=$1 AND account_id=$2`, tenantID, accountID).Scan(&enabled)
		if err != nil || !enabled {
			writeJSON(w, http.StatusNotFound, map[string]string{"code": "not_found"})
			return
		}
		var body historyRequest
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&body) != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_request"})
			return
		}
		history, ok := provider.(interface {
			RequestHistory(context.Context, string, historyRequest) error
		})
		if !ok {
			writeJSON(w, http.StatusNotImplemented, map[string]string{"code": "history_unavailable"})
			return
		}
		if err := history.RequestHistory(r.Context(), accountID, body); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"code": "history_request_failed"})
			return
		}
		writeJSON(w, http.StatusAccepted, map[string]bool{"requested": true})
	})
	mux.HandleFunc("GET /v1/tenants/{tenantId}/accounts", func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.PathValue("tenantId")
		if !authorizedTenant(r.Header.Get("Authorization"), master, tenantID) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"code": "unauthorized"})
			return
		}
		rows, err := db.QueryContext(r.Context(), `SELECT account_id::text,tenant_id::text,device_jid,enabled FROM syndes_whatsapp_accounts WHERE tenant_id=$1 ORDER BY account_id`, tenantID)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"code": "store_unavailable"})
			return
		}
		defer rows.Close()
		accounts := make([]accountRecord, 0)
		for rows.Next() {
			var a accountRecord
			if err := rows.Scan(&a.AccountID, &a.TenantID, &a.DeviceJID, &a.Enabled); err != nil {
				writeJSON(w, http.StatusServiceUnavailable, map[string]string{"code": "store_unavailable"})
				return
			}
			if live, ok := provider.(interface{ Connected(string) bool }); ok {
				a.Connected = live.Connected(a.AccountID)
			}
			accounts = append(accounts, a)
		}
		if rows.Err() != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"code": "store_unavailable"})
			return
		}
		writeJSON(w, http.StatusOK, accounts)
	})
	mux.HandleFunc("PATCH /v1/tenants/{tenantId}/accounts/{accountId}/enabled", func(w http.ResponseWriter, r *http.Request) {
		tenantID, accountID := r.PathValue("tenantId"), r.PathValue("accountId")
		if !authorizedTenant(r.Header.Get("Authorization"), master, tenantID) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"code": "unauthorized"})
			return
		}
		if !validUUID(accountID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_account"})
			return
		}
		var body struct {
			Enabled *bool `json:"enabled"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&body) != nil || body.Enabled == nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_request"})
			return
		}
		result, err := db.ExecContext(r.Context(), `UPDATE syndes_whatsapp_accounts
    SET enabled=$3,updated_at=now() WHERE tenant_id=$1 AND account_id=$2`, tenantID, accountID, *body.Enabled)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"code": "store_unavailable"})
			return
		}
		n, err := result.RowsAffected()
		if err != nil || n != 1 {
			writeJSON(w, http.StatusNotFound, map[string]string{"code": "not_found"})
			return
		}
		if !*body.Enabled {
			if pause, ok := provider.(interface{ Pause(string) }); ok {
				pause.Pause(accountID)
			}
		}
		writeJSON(w, http.StatusOK, map[string]bool{"enabled": *body.Enabled})
	})
	// Tenant-bound outbound status is read-only; the gateway never accepts a caller-chosen tenant for a message.
	mux.HandleFunc("GET /v1/tenants/{tenantId}/accounts/{accountId}/outbox/{queueId}", func(w http.ResponseWriter, r *http.Request) {
		tenantID, accountID := r.PathValue("tenantId"), r.PathValue("accountId")
		if !authorizedTenant(r.Header.Get("Authorization"), master, tenantID) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"code": "unauthorized"})
			return
		}
		if !validUUID(accountID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_account"})
			return
		}
		queueID, parseErr := strconv.ParseInt(r.PathValue("queueId"), 10, 64)
		if parseErr != nil || queueID <= 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_queue_id"})
			return
		}
		var status string
		var externalID sql.NullString
		err := db.QueryRowContext(r.Context(), `SELECT o.status,o.external_message_id
  FROM syndes_whatsapp_outbound o JOIN syndes_whatsapp_accounts a ON a.account_id=o.account_id
  WHERE a.tenant_id=$1 AND o.account_id=$2 AND o.id=$3`, tenantID, accountID, queueID).Scan(&status, &externalID)
		if err == sql.ErrNoRows {
			writeJSON(w, http.StatusNotFound, map[string]string{"code": "not_found"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"code": "store_unavailable"})
			return
		}
		writeJSON(w, http.StatusOK, struct {
			QueueID           int64   `json:"queueId"`
			AccountID         string  `json:"accountId"`
			Status            string  `json:"status"`
			ExternalMessageID *string `json:"externalMessageId,omitempty"`
		}{QueueID: queueID, AccountID: accountID, Status: status, ExternalMessageID: nullableString(externalID)})
	})
	mux.HandleFunc("POST /v1/tenants/{tenantId}/accounts", func(w http.ResponseWriter, r *http.Request) {
		tenantID := r.PathValue("tenantId")
		if !authorizedTenant(r.Header.Get("Authorization"), master, tenantID) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"code": "unauthorized"})
			return
		}
		var body struct {
			AccountID string `json:"accountId"`
		}
		decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2048))
		decoder.DisallowUnknownFields()
		if decoder.Decode(&body) != nil || !validUUID(body.AccountID) {
			writeJSON(w, http.StatusBadRequest, map[string]string{"code": "invalid_account"})
			return
		}
		result, err := db.ExecContext(r.Context(), `INSERT INTO syndes_whatsapp_accounts(account_id,tenant_id)
   VALUES($1,$2) ON CONFLICT(account_id) DO UPDATE SET updated_at=now()
   WHERE syndes_whatsapp_accounts.tenant_id=EXCLUDED.tenant_id`, body.AccountID, tenantID)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"code": "store_unavailable"})
			return
		}
		rows, _ := result.RowsAffected()
		if rows != 1 {
			writeJSON(w, http.StatusConflict, map[string]string{"code": "account_owned_by_other_tenant"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
func (gateway *whatsmeowGateway) Connected(accountID string) bool {
	gateway.mu.RLock()
	client := gateway.clients[accountID]
	gateway.mu.RUnlock()
	return client != nil && client.IsConnected() && client.IsLoggedIn()
}

func nullableString(s sql.NullString) *string {
	if !s.Valid {
		return nil
	}
	return &s.String
}
