package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"go.mau.fi/whatsmeow/types"
)

type groupDetails struct {
	JID              string `json:"jid"`
	Name             string `json:"name"`
	Description      string `json:"description"`
	ParticipantCount int    `json:"participantCount"`
	CanEdit          bool   `json:"canEdit"`
	Locked           bool   `json:"locked"`
	Announce         bool   `json:"announce"`
}
type groupChange struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

func groupJID(raw string) (types.JID, error) {
	jid, err := types.ParseJID(raw)
	if err != nil || jid.Server != types.GroupServer || jid.Device != 0 || len(jid.User) < 8 {
		return types.JID{}, errors.New("invalid group JID")
	}
	return jid, nil
}
func validGroupChange(input groupChange) error {
	if (input.Name == nil) == (input.Description == nil) {
		return errors.New("exactly one group field required")
	}
	if input.Name != nil && (strings.TrimSpace(*input.Name) == "" || len([]rune(*input.Name)) > 100) {
		return errors.New("invalid group name")
	}
	if input.Description != nil && len([]rune(*input.Description)) > 2048 {
		return errors.New("invalid group description")
	}
	return nil
}
func (gateway *whatsmeowGateway) GetGroupDetails(ctx context.Context, accountID, rawJID string) (groupDetails, error) {
	jid, err := groupJID(rawJID)
	if err != nil {
		return groupDetails{}, err
	}
	client, err := gateway.client(ctx, accountID)
	if err != nil {
		return groupDetails{}, err
	}
	if !client.IsConnected() || !client.IsLoggedIn() {
		return groupDetails{}, errors.New("session disconnected")
	}
	info, err := client.GetGroupInfo(ctx, jid)
	if err != nil {
		return groupDetails{}, err
	}
	editable := !info.IsLocked
	if info.IsLocked {
		editable = false
		self := client.Store.ID
		if self != nil {
			for _, p := range info.Participants {
				if p.JID.ToNonAD() == self.ToNonAD() {
					editable = p.IsAdmin || p.IsSuperAdmin
					break
				}
			}
		}
	}
	count := info.ParticipantCount
	if count <= 0 {
		count = len(info.Participants)
	}
	return groupDetails{JID: jid.String(), Name: info.Name, Description: info.Topic,
		ParticipantCount: count, CanEdit: editable, Locked: info.IsLocked, Announce: info.IsAnnounce}, nil
}
func (gateway *whatsmeowGateway) UpdateGroupDetails(ctx context.Context, accountID, rawJID string, change groupChange) (groupDetails, error) {
	if err := validGroupChange(change); err != nil {
		return groupDetails{}, err
	}
	before, err := gateway.GetGroupDetails(ctx, accountID, rawJID)
	if err != nil {
		return groupDetails{}, err
	}
	if !before.CanEdit {
		return groupDetails{}, errors.New("group permission denied by WhatsApp")
	}
	jid, _ := groupJID(rawJID)
	client, err := gateway.client(ctx, accountID)
	if err != nil {
		return groupDetails{}, err
	}
	if change.Name != nil {
		if err := client.SetGroupName(ctx, jid, strings.TrimSpace(*change.Name)); err != nil {
			return groupDetails{}, err
		}
	} else {
		if err := client.SetGroupTopic(ctx, jid, "", "", strings.TrimSpace(*change.Description)); err != nil {
			return groupDetails{}, err
		}
	}
	// WhatsApp remains the source of truth. Never report a desired value as confirmed.
	confirmCtx, cancel := context.WithTimeout(ctx, 8*time.Second)
	defer cancel()
	return gateway.GetGroupDetails(confirmCtx, accountID, rawJID)
}
func (gateway *whatsmeowGateway) syncJoinedGroups(tenantID, accountID string) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()
	client, err := gateway.client(ctx, accountID)
	if err != nil || !client.IsConnected() {
		return
	}
	groups, err := client.GetJoinedGroups(ctx)
	if err != nil {
		return
	}
	for _, g := range groups {
		if g == nil || g.JID.Server != types.GroupServer {
			continue
		}
		name := strings.TrimSpace(g.Name)
		if len(name) > 160 {
			name = name[:160]
		}
		gateway.storeChatEvent(ctx, tenantID, accountID, inboundEvent{AccountID: accountID, Chat: &chatEvent{
			AccountID: accountID, ChatExternalID: g.JID.String(), IsGroup: true, Name: name,
		}})
	}
}

// Revisions of a group are separate idempotent events, so renames are not
// silently discarded by the persistent callback/outbox deduplication.
func chatSnapshotKey(chat chatEvent) string {
	data := chat.ChatExternalID + "|" + chat.Name + "|" + fmt.Sprint(chat.UnreadCount) + "|" + fmt.Sprint(chat.Archived)
	digest := sha256.Sum256([]byte(data))
	return "chat:" + hex.EncodeToString(digest[:])
}

func (gateway *whatsmeowGateway) syncSingleGroup(tenantID, accountID string, jid types.JID) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if _, err := groupJID(jid.String()); err != nil {
		return
	}
	client, err := gateway.client(ctx, accountID)
	if err != nil || !client.IsConnected() {
		return
	}
	info, err := client.GetGroupInfo(ctx, jid)
	if err != nil {
		return
	}
	name := strings.TrimSpace(info.Name)
	if name == "" {
		return
	}
	if len(name) > 160 {
		name = name[:160]
	}
	gateway.storeChatEvent(ctx, tenantID, accountID, inboundEvent{AccountID: accountID, Chat: &chatEvent{
		AccountID: accountID, ChatExternalID: jid.String(), IsGroup: true, Name: name,
	}})
}
