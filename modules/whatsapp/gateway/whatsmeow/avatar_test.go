package main

import "testing"

func TestAvatarJIDIsRestrictedToWhatsAppContactsAndGroups(t *testing.T) {
	for _, valid := range []string{"5551999999999@s.whatsapp.net", "12345678901234@lid", "120363012345678901@g.us"} {
		if _, err := avatarJID(valid); err != nil {
			t.Errorf("%s rejected: %v", valid, err)
		}
	}
	for _, bad := range []string{"", "invalid", "123@s.whatsapp.net", "1234567890@newsletter", "127.0.0.1", "120363012345678901@g.us/test"} {
		if _, err := avatarJID(bad); err == nil {
			t.Errorf("%s accepted", bad)
		}
	}
}
func TestWhatsAppAvatarURLAllowlistRejectsInternalHosts(t *testing.T) {
	for _, valid := range []string{"https://pps.whatsapp.net/profile/id", "https://abc.fna.fbcdn.net/file?t=1"} {
		if !safeWhatsAppAvatarURL(valid) {
			t.Errorf("valid host rejected: %s", valid)
		}
	}
	for _, bad := range []string{"http://pps.whatsapp.net/picture", "https://127.0.0.1/test", "https://localhost/x",
		"https://pps.whatsapp.net.evil.example/image", "https://evil.example/", "https://user:pass@pps.whatsapp.net/image",
		"https://pps.whatsapp.net:9443/picture"} {
		if safeWhatsAppAvatarURL(bad) {
			t.Errorf("untrusted origin accepted: %s", bad)
		}
	}
}
