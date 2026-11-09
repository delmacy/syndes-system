package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"strings"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

// Names received via companion-device sync are metadata, not messages.
// They can update existing Inbox conversations but may not create new ones.
type contactEvent struct {
	AccountID         string `json:"accountId"`
	ContactExternalID string `json:"contactExternalId"`
	Name              string `json:"name"`
}

func safeContactName(name string) string {
	name = strings.TrimSpace(name)
	if name == "-" || len(name) == 0 || len(name) > 160 {
		return ""
	}
	return name
}

func preferredContactName(info types.ContactInfo) string {
	for _, name := range []string{info.FullName, info.FirstName, info.BusinessName, info.PushName} {
		if clean := safeContactName(name); clean != "" {
			return clean
		}
	}
	return ""
}

func (gateway *whatsmeowGateway) publishContactName(tenantID, accountID string, jid types.JID, name string) {
	name = safeContactName(name)
	if name == "" || (jid.Server != types.DefaultUserServer && jid.Server != types.HiddenUserServer) {
		return
	}
	// Repeating a name is deduplicated persistently in the outbox.
	external := sha256.Sum256([]byte(jid.ToNonAD().String() + "|" + name))
	gateway.enqueueInbound(context.Background(), tenantID, accountID, inboundEvent{
		AccountID: accountID, ExternalMessageID: "contact:" + hex.EncodeToString(external[:]),
		EventType: "whatsapp.contact.name", Contact: &contactEvent{
			AccountID: accountID, ContactExternalID: jid.ToNonAD().String(), Name: name,
		},
	})
}

func (gateway *whatsmeowGateway) cachedContactName(client *whatsmeow.Client, jid types.JID) string {
	if client == nil || client.Store == nil || client.Store.Contacts == nil {
		return ""
	}
	info, err := client.Store.Contacts.GetContact(context.Background(), jid.ToNonAD())
	if err != nil {
		return ""
	}
	return preferredContactName(info)
}
func (gateway *whatsmeowGateway) syncContactFromCache(tenantID, accountID string, client *whatsmeow.Client, jid types.JID) {
	if name := gateway.cachedContactName(client, jid); name != "" {
		gateway.publishContactName(tenantID, accountID, jid, name)
	}
}
func (gateway *whatsmeowGateway) syncCachedContactNames(tenantID, accountID string, client *whatsmeow.Client) {
	if client == nil || client.Store == nil || client.Store.Contacts == nil {
		return
	}
	contacts, err := client.Store.Contacts.GetAllContacts(context.Background())
	if err != nil {
		return
	}
	// Bound each reconnect scan to avoid flooding the queue on large address books.
	count := 0
	for jid, info := range contacts {
		if count >= 5000 {
			break
		}
		if name := preferredContactName(info); name != "" {
			gateway.publishContactName(tenantID, accountID, jid, name)
			count++
		}
	}
}
