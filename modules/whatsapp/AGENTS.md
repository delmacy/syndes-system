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

## WA-DATA-01 e CRM-WA-01 (2026-11-11)

O gateway mede eventos text-only e conteúdo descartado antes da fila, SEM corpo, número, nome ou JID nos contadores. Os contadores são em memória e não substituem o ledger persistido; não habilitar logs de mensagens nem inventar retenção. A rota interna /diagnostics/coverage exige token do tenant e conta ativa.

O planejador crm-link-plan.ts é somente SELECT e recusa cross-org, LID sem telefone verificado e correspondência ambígua. Nunca converter propose_provisional em pessoa automaticamente, nem fazer merge por nome parecido. A escrita transacional auditável exige etapa distinta, homologação e aprovação. Ver docs/engineering/WA-DATA-01-CRM-WA-01-20261111.md e WBS-WA-DATA-CRM-WA-20261111.md.

## Exclusividade de projetor (WA-CUT, 2026-11-11)

A migration 008 cria `whatsapp_inbound_events.projection_path` com default `legacy`, imutável; para `events`, exige inbound textual. `WhatsAppInboxProjection` filtra legacy com compatibilidade antes/depois da migration; `WhatsAppTransactionalInboundBridge` grava path events e NÃO publica para duplicado legacy; as portas de read/ack do novo caminho só aceitam events. **Não confundir isso com um switch operacional instalado**: antes de ativar ingress novo deve-se provar que nenhuma instância antiga do worker legado sem filtro continua rodando. Snapshot/chat/contact/receipt, outbound e histórico permanecem no legado. Sem mudança de `projection_path` por UPDATE. Ver ADR-WHATSAPP-SINGLE-PROJECTOR-20261111.md.

## WhatsApp → Platform Events (opt-in técnico)

`event-bridge.ts` é um produtor transacional `whatsapp.message.received.v2` com referência decimal do ID BIGINT, sem corpo/JID/telefone na outbox. `event-route-commands.ts` é a porta pública de comando WhatsApp usada pela Inbox (rota e confirmação), e `event-identity-reader.ts` é read-only para CRM. A nova ponte só é usada se explicitamente injetada no `WhatsAppInboundStore`; o Nest/HTTP atual não a injeta e continua no modo legacy. Não coexistir dois projetores do mesmo inbound em produção; não mudar Workflows, Control DB, mídia ou SQL 002. Ver ADR-EVENTS-WHATSAPP-INBOX-CRM-20261111.md.
