package main

import (
    "testing"
    "go.mau.fi/whatsmeow/types"
)

func TestWhatsAppContactNamePriority(t *testing.T) {
    scenarios := []struct{
        contact types.ContactInfo
        want string
    }{
        {types.ContactInfo{FullName:"  Nome salvo  ",BusinessName:"Comércio",PushName:"Apelido"},"Nome salvo"},
        {types.ContactInfo{BusinessName:"Comércio",PushName:"Apelido"},"Comércio"},
        {types.ContactInfo{PushName:"Apelido"},"Apelido"},
        {types.ContactInfo{},""},
    }
    for _,tt:=range scenarios {
        got:=preferredWhatsAppName(tt.contact)
        if got!=tt.want{t.Fatalf("got %q, want %q",got,tt.want)}
    }
}

func TestWhatsAppContactNameTruncatesLongNames(t *testing.T) {
    value:=""
    for i:=0;i<200;i++{value+="ç"}
    got:=preferredWhatsAppName(types.ContactInfo{FullName:value})
    if len([]rune(got))!=160{t.Fatalf("got %d runes",len([]rune(got)))}
}
