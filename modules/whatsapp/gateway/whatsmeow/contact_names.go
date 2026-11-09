package main

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waSyncAction"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

type contactNameChange struct {
	ContactJID               string `json:"contactJid"`
	FullName                 string `json:"fullName"`
	SaveOnPrimaryAddressbook bool   `json:"saveOnPrimaryAddressbook"`
}

func contactNamePatch(input contactNameChange) (appstate.PatchInfo, types.JID, error) {
	name := strings.TrimSpace(input.FullName)
	if name == "" || utf8.RuneCountInString(name) > 160 || strings.ContainsAny(name, "\x00\n\r\t") {
		return appstate.PatchInfo{}, types.JID{}, errors.New("invalid contact name")
	}
	jid, err := types.ParseJID(input.ContactJID)
	if err != nil || jid.Device != 0 || verifiedPhone(jid) == "" || jid.String() != input.ContactJID {
		return appstate.PatchInfo{}, types.JID{}, errors.New("invalid phone-number JID")
	}
	first := strings.Fields(name)[0]
	return appstate.PatchInfo{
		Type: appstate.WAPatchCriticalUnblockLow,
		Mutations: []appstate.MutationInfo{{
			Index: []string{appstate.IndexContact, jid.String()}, Version: 2,
			Value: &waSyncAction.SyncActionValue{
				ContactAction: &waSyncAction.ContactAction{
					FullName: proto.String(name), FirstName: proto.String(first),
					PnJID:                    proto.String(jid.String()),
					SaveOnPrimaryAddressbook: proto.Bool(input.SaveOnPrimaryAddressbook),
				},
			},
		}},
	}, jid, nil
}

// SubmitContactName updates the linked-device WhatsApp contact state.
// SendAppState success confirms server acknowledgement, NOT the phone's own
// addressbook state; the user must verify on WhatsApp Web/primary handset.
func (gateway *whatsmeowGateway) SubmitContactName(ctx context.Context, accountID string, input contactNameChange) error {
	patch, jid, err := contactNamePatch(input)
	if err != nil {
		return err
	}
	client, err := gateway.client(ctx, accountID)
	if err != nil {
		return err
	}
	if !client.IsConnected() || !client.IsLoggedIn() {
		return errors.New("linked device disconnected")
	}
	if err := client.SendAppState(ctx, patch); err != nil {
		return fmt.Errorf("contact app-state rejected: %w", err)
	}
	// SendAppState schedules a state resync. Avoid a local-only write before
	// acceptance; don't pretend that a device-ack is phone addressbook proof.
	if client.Store != nil && client.Store.Contacts != nil {
		if err := client.Store.Contacts.PutContactName(ctx, jid, strings.Fields(input.FullName)[0], strings.TrimSpace(input.FullName)); err != nil {
			// The remote patch was accepted; keep the remote outcome authoritative.
			return nil
		}
	}
	return nil
}
