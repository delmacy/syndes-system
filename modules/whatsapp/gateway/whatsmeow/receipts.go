package main

// Receipt events must be provider-confirmed. No inferred delivery from
// a successful SendMessage or an imported outgoing history entry.
type receiptEvent struct {
	AccountID         string `json:"accountId"`
	ProviderMessageID string `json:"providerMessageId"`
	ChatExternalID    string `json:"chatExternalId"`
	Status            string `json:"status"`
}
