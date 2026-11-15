# I09 — Whatsmeow runtime | Referência técnica

> Componente Go de [P03 WhatsApp](../P03-whatsapp/REFERENCIA-TECNICA.md). Inventário de fonte, não contrato externo homologado. Base `main` a1754ccc, 13/11/2026.

## Stack e fronteira
- [go.mod](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/go.mod): Go 1.26, `go.mau.fi/whatsmeow`, `pgx/v5`, protobuf.
- [README](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/README.md): sidecar interno, loopback por padrão; API Nest consome operações autenticadas; callback retorna à API com token separado.
- Nenhum frontend próprio identificado nas fontes lidas. O produto e telas pertencem a P03 e outros owners.

## Backend e métodos observados
| Fonte | Símbolos | Evidência e limite |
|---|---|---|
| [main.go](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/main.go) | `loadConfig`, `newAccountHTTPHandler`, `authorizeAccount`, `accountToken` | Configuração, HTTP, HMAC SHA-256 por tenant/conta; não é SDK público |
| [gateway.go](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/gateway.go) | `whatsmeowGateway`, `restore`, `newQRSession`, `Coverage` | Sessões, QR e cobertura; operação real não testada |
| [outbound.go](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/outbound.go) | `Send`, `startOutboundDispatcher`, `deliverOutbound` | Outbox e rate reservation; não prova entrega exatamente uma vez |

## HTTP e eventos
- `GET /healthz` retorna status do handler; não comprova conectividade com WhatsApp ou PostgreSQL.
- `POST /v1/accounts/{accountId}/{operation}`: operações `pairing`, `connect`, `disconnect`, `messages`, com autorização por conta. Endpoint interno, não API pública de cliente.
- [main_test.go](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/main_test.go) contém caso para envelope `whatsapp.message.received`, versão `1`, tenantId e accountId. Teste definido, não executado nesta revisão.

## Dados e segurança
- [main.go](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/main.go) declara SQL de inicialização para `syndes_whatsapp_accounts` e `syndes_whatsapp_inbound_outbox`, com migração legada condicional. Não afirmar execução em banco real.
- [outbound.go](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/outbound.go) utiliza `syndes_whatsapp_outbound` e `syndes_whatsapp_send_windows`, com lock transacional e quota por conta; ownership é do armazenamento do adaptador, distinto do Tenant DB de negócio e do Control.
- `WHATSAPP_STORE_DSN`, `SYNDES_API_URL`, `WHATSAPP_WHATSMEOW_TOKEN`, `WHATSAPP_WEBHOOK_TOKEN` são **nomes** de variáveis exigidas, sem valores publicados.

## Testes e limites
[main_test.go](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/gateway/whatsmeow/main_test.go) prova apenas existência de testes no código. Não há evidência nesta revisão de `go test`, integração PG, sessão real, deploy ou aceite.
