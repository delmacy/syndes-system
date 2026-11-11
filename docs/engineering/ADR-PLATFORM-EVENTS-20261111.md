# ADR — Platform Events no Syndes (2026-11-11)

**Status:** aprovado para implementação técnica isolada; **não implantado nem homologado em produção**.

## Decisão
Manter o monólito NestJS e PostgreSQL 17 com **um schema `platform_events` por database de tenant**, sem broker externo. O banco `syndes_control` fica intocado, com outbox global planejada para gate posterior. Tabelas de CRM/Inbox/WhatsApp continuam no `public`; nunca migrar nesse trabalho. Os eventos contêm **referências UUID**, não bodies, telefones, nomes nem mídia.

## Fonte de verdade e isolamento
- CRM é dono de pessoas/identidades; Inbox, de conversas/vínculos; WhatsApp, de inbound/outbound; Organizations, dos escopos.
- O schema depende de `organizations/sql/001_account_hierarchy.sql`: FKs `(tenant_id,organization_id)` e `(tenant_id,organization_id,workspace_id)` impedem referência a escopo inexistente ou de outra organização.
- O provider só resolve database por UUID e registro confiável, sem DSN de usuário; a transação real usa **um `pg.Client` fixado** de `pool.connect()` com verificação `current_database()`, BEGIN/COMMIT/ROLLBACK e release.
- `TenantTransaction` possui marcador de lease, distinto do query-only `TenantDatabase`. O publisher exige este marcador. Operação e evento vivem no mesmo commit.
- `idempotency_key` é único por `tenant_id + producer` e só pode representar o mesmo fato. Colisão contraditória aborta.
- Migração versionada `001_platform_events` é emitida pelo CLI confiável de migrations como `platform_events`. A aplicação a tenants permanece **não executada operacionalmente**.

## Contratos v1
- `crm.person.created.v1` (CRM → consumidores futuros: Inbox e auditoria); `{personId}`.
- `whatsapp.message.received.v1` (WhatsApp → Inbox); `{inboundEventId,accountId}`.
- `inbox.participant.observed.v1` (Inbox → CRM); `{conversationId}`.
- `crm.person.resolved.v1` (CRM → Inbox); `{conversationId,personId}`.
- `crm.person.review_required.v1` (CRM → revisão); `{conversationId,reason}`.

Estes são **contratos disponíveis**, não eventos publicados pelo fluxo operacional. Não confundir tipo declarado com producer/consumer já conectado.

## Dispatch e recuperação — próximo incremento
O schema já prepara `event_deliveries` (por consumer, lease, retries) e `consumer_inbox` (deduplicação), mas ainda requer dispatcher funcional e registro dos handlers. Escolha: entrega *at least once*, claims com SKIP LOCKED, marcação de efeito + inbox na mesma transação, backoff limitado, dead-letter lógico e autorização explícita de identidade de serviço; jamais fabricar JWT de usuário. Sem enforcement ENABLED operacional, **não ativar workers em produção**.

## Retenção
Nunca expurgar automaticamente eventos pendentes, em retry, suspended ou com lease. Retenção inicial conservadora, sem job de purga ativo. Quando houver homologação, definir TTL e procedimento de arquivamento/export com provas de terminalidade por consumidor, backup/restore testados e limite de crescimento. Estado `unsupported` deve ficar consultável e reprocessável com operação autorizada, não descartado.

## Pendências e Product Gates
- PR1: schema, contratos, provider transacional, publisher e testes PG17 descartáveis.
- PR2: dispatcher, module gate, leases e consumidores idempotentes reais.
- PR3: cadeia WhatsApp → Inbox → CRM → vínculo validado em banco **descartável**.
- PR4: Control Plane events em banco control com procedimento seguro próprio.
- Bloqueados: DDL/DML operacional, criação automática de 14 contatos provisórios, reconciliação operacional, módulo enforcement sem Control DB preparado, multi-org, mídia.
- Testes PG17 de PR1 são locais e descartáveis; **CI externa e deploy operacional exigem verificações separadas**.

## Operação e reversão
1. Verificar git/CI, consistência das migrations de Organizations e SQL 002, backup e restore testado antes de qualquer tenant real.
2. Aplicar somente release autorizada do schema por tenant e conferir tabelas/índices/FKs com ledger. Sem DDL em `syndes_control`.
3. Ativar publishers apenas após migration em todos os tenants participantes; ativar consumidores só com identidade de serviço, módulo ENABLED e política de recuperação comprovada.
4. Em incidente, desabilitar dispatcher/publishers via configuração de operação aprovada; preservar outbox/inbox para reconciliação. Não usar DROP nem limpeza de eventos como rollback.
