package main

import (
    "context"
    "errors"
    "strings"

    "go.mau.fi/whatsmeow/types"
)

// Stored contact fields belong to a linked WhatsApp account. Never infer a
// name from a LID or return the primary phone's own contact list publicly.
func preferredWhatsAppName(info types.ContactInfo) string {
    for _, candidate := range []string{info.FullName, info.BusinessName, info.PushName} {
        if name := strings.TrimSpace(candidate); name != "" {
            if len([]rune(name)) > 160 { return string([]rune(name)[:160]) }
            return name
        }
    }
    return ""
}

func (gateway *whatsmeowGateway) LookupContactNames(ctx context.Context, accountID string, jids []string) (map[string]string, error) {
    if len(jids) == 0 || len(jids) > 100 {
        return nil, errors.New("invalid lookup size")
    }
    client, err := gateway.client(ctx, accountID)
    if err != nil { return nil, err }
    if client.Store == nil || client.Store.Contacts == nil {
        return nil, errors.New("contact store unavailable")
    }
    result := make(map[string]string)
    for _, raw := range jids {
        jid, err := types.ParseJID(raw)
        if err != nil || jid.Device != 0 || verifiedPhone(jid) == "" || jid.String() != raw {
            return nil, errors.New("invalid contact JID")
        }
        info, err := client.Store.Contacts.GetContact(ctx, jid)
        if err != nil { return nil, err }
        name := preferredWhatsAppName(info)
        if name == "" {
            alt, err := client.Store.GetAltJID(ctx, jid)
            if err == nil && !alt.IsEmpty() && alt.Server == types.HiddenUserServer {
                other, err := client.Store.Contacts.GetContact(ctx, alt)
                if err == nil { name = preferredWhatsAppName(other) }
            }
        }
        if name != "" { result[raw] = name }
    }
    return result, nil
}
