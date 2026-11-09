package main

import (
	"context"
	"encoding/base64"
	"errors"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
)

const avatarMaxBytes = 128 * 1024

type avatarResult struct {
	ImageData string `json:"imageData,omitempty"`
	Available bool   `json:"available"`
}

func avatarJID(raw string) (types.JID, error) {
	jid, err := types.ParseJID(raw)
	if err != nil || jid.Device != 0 || len(jid.User) < 7 {
		return types.JID{}, errors.New("invalid avatar JID")
	}
	if jid.Server != types.DefaultUserServer && jid.Server != types.HiddenUserServer && jid.Server != types.GroupServer {
		return types.JID{}, errors.New("avatar JID unsupported")
	}
	return jid, nil
}
func safeWhatsAppAvatarURL(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.User != nil || u.Port() != "" || u.Fragment != "" {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "" || net.ParseIP(host) != nil {
		return false
	}
	return host == "whatsapp.net" || strings.HasSuffix(host, ".whatsapp.net") ||
		host == "fbcdn.net" || strings.HasSuffix(host, ".fbcdn.net")
}
func avatarRequest(client *whatsmeow.Client, ctx context.Context, jid types.JID) (avatarResult, error) {
	if client == nil || !client.IsConnected() || !client.IsLoggedIn() {
		return avatarResult{}, errors.New("WhatsApp account offline")
	}
	picture, err := client.GetProfilePictureInfo(ctx, jid, &whatsmeow.GetProfilePictureParams{Preview: true})
	if err != nil || picture == nil || picture.URL == "" {
		return avatarResult{Available: false}, nil
	}
	if !safeWhatsAppAvatarURL(picture.URL) {
		return avatarResult{}, errors.New("untrusted avatar origin")
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.DisableKeepAlives = true
	httpClient := &http.Client{Timeout: 7 * time.Second, Transport: transport, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, picture.URL, nil)
	if err != nil {
		return avatarResult{}, err
	}
	response, err := httpClient.Do(request)
	if err != nil {
		return avatarResult{}, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return avatarResult{Available: false}, nil
	}
	if response.ContentLength > avatarMaxBytes {
		return avatarResult{Available: false}, nil
	}
	bytes, err := io.ReadAll(io.LimitReader(response.Body, avatarMaxBytes+1))
	if err != nil {
		return avatarResult{}, err
	}
	if len(bytes) < 16 || len(bytes) > avatarMaxBytes {
		return avatarResult{Available: false}, nil
	}
	mime := ""
	if len(bytes) > 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff {
		mime = "image/jpeg"
	} else if len(bytes) > 8 && string(bytes[:4]) == "\x89PNG" {
		mime = "image/png"
	} else if len(bytes) > 12 && string(bytes[:4]) == "RIFF" && string(bytes[8:12]) == "WEBP" {
		mime = "image/webp"
	}
	if mime == "" {
		return avatarResult{Available: false}, nil
	}
	return avatarResult{Available: true, ImageData: "data:" + mime + ";base64," + base64.StdEncoding.EncodeToString(bytes)}, nil
}
func (gateway *whatsmeowGateway) GetAvatar(ctx context.Context, accountID, rawJID string) (avatarResult, error) {
	jid, err := avatarJID(rawJID)
	if err != nil {
		return avatarResult{}, err
	}
	client, err := gateway.client(ctx, accountID)
	if err != nil {
		return avatarResult{}, err
	}
	return avatarRequest(client, ctx, jid)
}
