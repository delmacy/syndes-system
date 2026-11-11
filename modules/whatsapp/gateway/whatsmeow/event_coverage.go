package main

import (
	"sync"

	"go.mau.fi/whatsmeow/types/events"
)

// This is deliberately ephemeral, bounded metadata for admission visibility.
// It never contains phone numbers, JIDs, message IDs, media bytes or message text.
// Counters reset when the gateway restarts; durable coverage is in the tenant
// event ledger (and its read-only quality report).
type eventCoverage struct {
	mu        sync.RWMutex
	byAccount map[string]map[string]uint64
}

func (c *eventCoverage) observe(accountID, category string) {
	if c == nil || accountID == "" || category == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.byAccount == nil {
		c.byAccount = make(map[string]map[string]uint64)
	}
	entry := c.byAccount[accountID]
	if entry == nil {
		entry = make(map[string]uint64)
		c.byAccount[accountID] = entry
	}
	entry[category]++
}

func (c *eventCoverage) snapshot(accountID string) map[string]uint64 {
	result := map[string]uint64{}
	if c == nil {
		return result
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	for category, count := range c.byAccount[accountID] {
		result[category] = count
	}
	return result
}

// Accepted text is distinct from content deliberately excluded from a
// text-only Inbox. A media event is not a failed message: it is unsupported by
// the current contract and must not silently masquerade as processed text.
func classifyInboundMessage(message *events.Message) string {
	if message == nil || message.Message == nil {
		return "invalid_envelope"
	}
	m := message.Message
	switch {
	case m.GetReactionMessage() != nil:
		return "reaction_unsupported"
	case m.GetProtocolMessage() != nil:
		return "protocol_control_ignored"
	case m.GetImageMessage() != nil:
		return "image_unsupported"
	case m.GetVideoMessage() != nil:
		return "video_unsupported"
	case m.GetAudioMessage() != nil:
		return "audio_unsupported"
	case m.GetDocumentMessage() != nil:
		return "document_unsupported"
	case m.GetStickerMessage() != nil:
		return "sticker_unsupported"
	case acceptedChatText(message) != "":
		return "text_eligible"
	default:
		return "other_unsupported"
	}
}
