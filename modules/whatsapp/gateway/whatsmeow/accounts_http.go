package main

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"net/http"
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
