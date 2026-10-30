# WA-03 — Inbound, identidade e idempotência

- Owner: API/Inbox integration
- Dependência: WA-01, WA-02
- Escopo: evento autenticado, deduplicação, identidade WhatsApp → CRM e entrega no Inbox.
- Aceite: evento repetido gera uma única mensagem; cross-tenant e unauthorized permanecem zero.
