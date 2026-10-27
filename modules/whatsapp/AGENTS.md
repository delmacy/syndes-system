# AGENTS.md — WhatsApp

## Missão

Implementar o canal WhatsApp com proteção operacional, mantendo provider substituível.

## Provider inicial

whatsmeow.

O domínio não deve expor whatsmeow ao restante da aplicação.

## Estrutura mínima

- session/account;
- connection;
- inbound;
- outbound queue;
- rate limit;
- priority;
- retry/backoff;
- deduplication;
- anti-spam;
- media;
- delivery status;
- health;
- audit;
- provider adapter.

## Rate limit obrigatório

**40 mensagens de saída por minuto por número.**

Fila e limite são por número/conta; um tenant não pode bloquear outro.

Prioridade:

1. human reply;
2. transactional;
3. automated reply;
4. campaign/bulk.

## Não fazer

- cold outreach;
- spam;
- scraping;
- mecanismos para contornar políticas do WhatsApp;
- envio direto ao provider ignorando fila/rate limit.

## Inadimplência

D+31 suspende o gateway.

Suspensão financeira não apaga sessão/configuração:

- configured = true
- authorized = true
- service_enabled = false
- reason = delinquency

Regularização reativa idempotentemente.

## Identidades

Suportar vínculo de JID/LID/telefone a ChannelIdentity do CRM; não usar telefone/JID como primary key da Person.

## Testes

- inbound/outbound;
- 40/min/account;
- tenant independence;
- retry/backoff;
- dedup;
- queue recovery;
- reconnect;
- delivery states;
- suspension/reactivation;
- mock provider stress;
- provider real em escala reduzida.
