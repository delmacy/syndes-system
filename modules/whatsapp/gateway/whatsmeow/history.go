package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waHistorySync"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
)

// Only actual text messages belong in the Inbox. Reactions, protocol changes,
// and other chat control events never become bot-eligible text messages.
func acceptedChatText(message *events.Message) string {
	if message == nil || message.Message == nil {
		return ""
	}
	if message.Message.GetReactionMessage() != nil || message.Message.GetProtocolMessage() != nil {
		return ""
	}
	return strings.TrimSpace(messageText(message.Message))
}
func validChatJID(jid types.JID) bool {
	return jid.Server == types.DefaultUserServer ||
		jid.Server == types.HiddenUserServer ||
		jid.Server == types.GroupServer
}
func (gateway *whatsmeowGateway) storeChatEvent(ctx context.Context, tenantID, accountID string, event inboundEvent) {
	if event.Chat != nil {
		event.EventType = "whatsapp.chat.snapshot"
		event.ExternalMessageID = chatSnapshotKey(*event.Chat)
	}
	gateway.enqueueInbound(ctx, tenantID, accountID, event)
}
func historyTimestamp(sec uint64) string {
	if sec == 0 {
		return ""
	}
	return time.Unix(int64(sec), 0).UTC().Format(time.RFC3339Nano)
}
func (gateway *whatsmeowGateway) handleHistory(tenantID, accountID string, client *whatsmeow.Client, history *waHistorySync.HistorySync) {
	if history == nil {
		return
	}
	// WhatsApp sends contact names separately from chat and message history.
	// Names update only existing Inbox threads and never create fake chats.
	// Initial and ON_DEMAND history carry chat metadata + message snapshots.
	for _, conversation := range history.GetConversations() {
		if conversation == nil {
			continue
		}
		chatJID, err := types.ParseJID(conversation.GetID())
		if err != nil || !validChatJID(chatJID) {
			continue
		}
		isGroup := chatJID.Server == types.GroupServer
		lastTime := historyTimestamp(conversation.GetConversationTimestamp())
		if lastTime == "" {
			lastTime = historyTimestamp(conversation.GetLastMsgTimestamp())
		}
		name := strings.TrimSpace(conversation.GetName())
		if !isGroup && name == "" {
			name = gateway.cachedContactName(client, chatJID)
		}
		if len(name) > 160 {
			name = name[:160]
		}
		meta := inboundEvent{AccountID: accountID, Chat: &chatEvent{
			AccountID: accountID, ChatExternalID: chatJID.String(),
			IsGroup: isGroup, Name: name, UnreadCount: conversation.GetUnreadCount(),
			Archived: conversation.GetArchived(), OccurredAt: lastTime,
		}}
		gateway.storeChatEvent(context.Background(), tenantID, accountID, meta)
		if !isGroup {
			gateway.syncContactFromCache(tenantID, accountID, client, chatJID)
		}
		for _, entry := range conversation.GetMessages() {
			if entry == nil || entry.GetMessage() == nil {
				continue
			}
			msg, err := client.ParseWebMessage(chatJID, entry.GetMessage())
			if err != nil {
				continue
			}
			body := acceptedChatText(msg)
			if body == "" || msg.Info.ID == "" || msg.Info.Timestamp.IsZero() {
				continue
			}
			senderJID := msg.Info.Sender
			if !validChatJID(senderJID) && msg.Info.IsFromMe {
				senderJID = chatJID
			}
			sender := senderJID.String()
			if sender == "" || !validChatJID(senderJID) {
				continue
			}
			phone := ""
			if !isGroup {
				phone = verifiedPhone(chatJID)
				if phone == "" {
					phone = senderPhoneForMessage(client, types.MessageSource{Sender: chatJID})
				}
			}
			payload := inboundEvent{AccountID: accountID, ExternalMessageID: msg.Info.ID,
				SenderExternalID: sender, SenderPhone: phone, ChatExternalID: chatJID.String(),
				IsGroup: isGroup, FromMe: msg.Info.IsFromMe, Source: "history",
				ChatName: name, Body: body, OccurredAt: msg.Info.Timestamp.UTC().Format(time.RFC3339Nano)}
			gateway.enqueueInbound(context.Background(), tenantID, accountID, payload)
		}
	}
	// Apply push names after chat snapshots, so initial synchronization can
	// create the thread before a name-only update is processed.
	for _, entry := range history.GetPushnames() {
		if entry == nil {
			continue
		}
		jid, err := types.ParseJID(entry.GetID())
		if err == nil {
			gateway.publishContactName(tenantID, accountID, jid, entry.GetPushname())
		}
	}

}

// The user can request more history for a known chat. WhatsApp sends the reply
// asynchronously as an events.HistorySync ON_DEMAND event. Never send to a
// third-party recipient: SendPeerMessage goes to the account's own phone.
type historyRequest struct {
	ChatExternalID string `json:"chatExternalId"`
	MessageID      string `json:"messageId"`
	FromMe         bool   `json:"fromMe"`
	Timestamp      string `json:"timestamp"`
	Count          int    `json:"count"`
}

func (gateway *whatsmeowGateway) RequestHistory(ctx context.Context, accountID string, req historyRequest) error {
	if req.Count < 1 || req.Count > 50 || len(req.MessageID) < 1 || len(req.MessageID) > 256 {
		return errors.New("invalid history request")
	}
	chat, err := types.ParseJID(req.ChatExternalID)
	if err != nil || !validChatJID(chat) {
		return errors.New("invalid history chat")
	}
	at, err := time.Parse(time.RFC3339Nano, req.Timestamp)
	if err != nil || at.IsZero() || at.After(time.Now().Add(time.Hour)) {
		return errors.New("invalid history timestamp")
	}
	client, err := gateway.client(ctx, accountID)
	if err != nil {
		return err
	}
	if !client.IsLoggedIn() || !client.IsConnected() {
		return errors.New("whatsapp session not connected")
	}
	anchor := &types.MessageInfo{MessageSource: types.MessageSource{
		Chat: chat, Sender: chat, IsFromMe: req.FromMe,
	}, ID: req.MessageID, Timestamp: at}
	_, err = client.SendPeerMessage(ctx, client.BuildHistorySyncRequest(anchor, req.Count))
	if err != nil {
		return fmt.Errorf("history request rejected: %w", err)
	}
	slog.Info("WhatsApp history sync requested", "account_id", accountID, "count", req.Count)
	return nil
}
func (gateway *whatsmeowGateway) historyForEvent(tenantID, accountID string, client *whatsmeow.Client, event *events.HistorySync) {
	if event == nil || event.Data == nil {
		return
	}
	go gateway.handleHistory(tenantID, accountID, client, event.Data)
}
