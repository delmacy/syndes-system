# ADR — Integração vertical de eventos WhatsApp → Inbox → CRM (2026-11-11)

**Status:** primeira cadeia funcional demonstrada em PostgreSQL 17 descartável. **Não ativada no Core Host operacional; nenhuma migration operacional aplicada; sem homologação de produção.**

## Contratos, ownership e fluxo

1. **WhatsApp** é produtor de `whatsapp.message.received.v2` (`{inboundEventId,accountId}`). `inboundEventId` é a representação **decimal canônica do BIGINT** de `whatsapp_inbound_events.id`, nunca um UUID inventado. A versão `v1` permanece declarada e inalterada para compatibilidade; o produtor novo emite só `v2`.
2. `WhatsAppTransactionalInboundBridge` valida o envelope autenticado, verifica conta habilitada + Organization/Workspace ativos e grava o inbound e o evento no mesmo `TenantPgProvider.withTransaction`. O payload no ledger é restrito a identificadores; mensagens, telefones e JIDs permanecem nas tabelas de negócio e só passam em DTO transitório entre portas públicas.
3. **Inbox** consome v2 por `InboxWhatsAppReceivedConsumer`, busca o payload via `PostgresWhatsAppInboundMessageReader` (porta de leitura pertencente ao WhatsApp), atualiza `inbox_conversations` e `inbox_messages`, e invoca o comando WhatsApp `PgWhatsAppConversationRouteCommands.attachAndAcknowledge`, sempre dentro da mesma transação de efeito + `consumer_inbox`. Publica `inbox.participant.observed.v1` (`{conversationId}`) para conversa direta inbound; grupos não geram resolução e não ativam bot.
4. **CRM** consome a observação com `CrmWhatsAppIdentityConsumer`, consulta rotas **somente pela porta de leitura** `PgWhatsAppConversationIdentityReader`, executa `CrmWhatsAppIdentityPolicy` por identidades de canal exatas e telefone confiável da origem no **mesmo Platform Organization**, e publica `crm.person.resolved.v1` (`{conversationId,personId}`) ou `crm.person.review_required.v1` (`{conversationId,reason}`: ambiguous/missing_identity/conflicting_link). Não cria pessoas automaticamente e não edita Inbox.
5. **Inbox** consome `crm.person.resolved.v1` com `InboxCrmPersonResolvedConsumer`: trava a conversa no escopo, recusa sobrescrever `crm_person_id` divergente e chama a mesma `CrmWhatsAppIdentityPolicy.validateLink` antes de escrever o vínculo. O vínculo e a confirmação são atômicos.

**Inscrições testadas:** `inbox.message-received-v2`, `crm.resolve-person`, `inbox.crm-person-link`. São registros de handlers **no teste integrado**; a configuração de assinaturas no Host e as identidades FGA de serviço **não foram ativadas**.

## Compatibilidade e política de migração

- O serviço `WhatsAppInboundStore` aceita **injetar explicitamente** a ponte transacional, mas seu construtor atual do Nest/HTTP não a injeta. O recebimento textual, suas outboxes legadas e a projeção atual continuam sem alteração operacional. **Não ativar dois projetores concorrentes** para a mesma origem até cutover planejado, ensaiado e autorizado.
- `WhatsApp` não manipula `crm_people`; `CRM` não edita Inbox; Inbox utiliza comandos/reads públicos dos proprietários para rotas e identidades.
- O controle SQL 002 mantém **single Organization/Workspace**; não o remover nem ativar multi-org. Recortes mais amplos (transferência entre workspaces/multi-org) exigem testes e política de roteamento antes do Product Gate.
- Falhas transitórias de CRM não interrompem a persistência WhatsApp; dispatcher mantém delivery suspensa/para retry. O recibo de WhatsApp e a mensagem são gravados na mesma transação do consumidor da Inbox. O envelope raw continua recuperável.
- `crm.person.review_required.v1` permanece no ledger para análise; **não há consumidor operacional de revisão**, tela ou fila de tratativa homologada. Eventos sem assinatura ativa ficam `routing_state=unsupported` até procedimento de replay/revisão. Isso não significa que a identidade tenha sido resolvida.
- CRM-WA-01 read-only permanece disponível; a nova política de eventos usa as mesmas regras conservadoras de correspondência exata e não modifica as 14 conversas do tenant operacional.
- Dados de mídia, histórico não textual, billing, telas e deploy ficaram fora deste incremento.

## Testes PostgreSQL 17 descartáveis

`apps/core-host/test/platform-events-whatsapp-crm-pg17.test.mjs` inicializa as migrations reais de Organizations, CRM, Inbox, WhatsApp e `platform_events` em database exclusivo com conexão localhost/credencial de fixture. Cenários: rollback de producer, resolução única, CRM suspenso e recuperação, idempotência de entrada, ausência de dados pessoais na outbox, grupo, falha após escrita Inbox com rollback integral, inexistência de auto-provisionamento, ambiguidade e validação de identidade alterada antes do vínculo.

## Gates pendentes

1. Provisionar `platform_events` por tenant após **backup e restore testado**, validação de migrations 001–005, controle de acesso e autorização explícita.
2. Construir a composição real do Host (tenant discovery, service principal, FGA/ENABLED e scheduler), ativada apenas com feature gate de cutover por tenant e **sem coexistência acidental** de projetores.
3. Implantar observabilidade, limitação de backlog, revisão assistida e recuperação de eventos sem assinaturas; definir política de retenção e replay.
4. Homologar no ambiente de teste autorizado com canários e confirmação de não duplicidade de conversas/rotas. Nenhum vínculo no tenant operacional sem aceite de reconciliação.
5. Outbox de Control Plane continua fora desta PR, bloqueada por backup/restore do `syndes_control`.

**Estados separados:** implementação e PG17 local ≠ merge no `main` ≠ implantação ≠ homologação operacional.
