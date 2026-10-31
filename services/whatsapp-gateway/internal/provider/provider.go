// Package provider defines the replaceable WhatsApp transport boundary.
// No business service may import whatsmeow directly.
package provider

import (
 "context"
 "errors"
)

var ErrNotConnected=errors.New("provider session is not connected")
type SessionStatus string
const(
 StatusDisconnected SessionStatus="disconnected"
 StatusConnecting SessionStatus="connecting"
 StatusConnected SessionStatus="connected"
)
type Incoming struct{
 SessionID string
 MessageID string
 ChatID string
 SenderID string
 Text string
}
type SendRequest struct{
 SessionID string
 Recipient string
 Text string
 IdempotencyKey string
}
type SendReceipt struct{ProviderMessageID string}
type EventSink interface{OnMessage(context.Context,Incoming)error}
type Transport interface{
 Start(context.Context,string,EventSink)error
 Stop(context.Context,string)error
 Status(context.Context,string)(SessionStatus,error)
 Send(context.Context,SendRequest)(SendReceipt,error)
}
