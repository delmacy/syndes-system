# ADR — Admissão de worker tenant-local antes da ativação (2026-11-11)

**Estado:** fronteira de autorização e composição tipadas implementadas e testadas, **não ativadas em nenhum Host operacional**. Nenhum scheduler, serviço de worker ou entrada HTTP foi instalado. Nenhum DDL/DML operacional.

## Decisão

O Event Bus da PR #84 executa `routePending/processNext` somente após receber um port `EventWorkerAuthorization`. Não usar um `allow-all`, claims de frontend, JWT inventado ou permissão de usuário para contornar esse port.

A implementação `apps/core-host/src/platform-event-worker-admission.ts` recebe quatro dependências obrigatórias:

1. `ModuleAccessPort` alimentado, em composição autorizada, por `PgEffectiveModuleAccess(PgModuleLifecycle/PgModuleCatalog)`, isto é: tenant ativo, release aprovada e compatível com o build, entitlement vigente, instalação ENABLED com receipt e dependências habilitadas. Não fazer consultas SQL diretas ao Control DB sem o read model já existente.
2. `PgEventWorkerScope`: lê o tenant database selecionado **exclusivamente** por `TrustedTenantDatabaseProvider.resolve`, exige Organization ativa e Workspace ativo pertencente à mesma Organization. Não cria nem escolhe Organization/Workspace default a partir do evento.
3. `TrustedServiceEventGrant`: porta **sem fallback** para identidade técnica *realmente autorizada*. O contrato exige o ator de tipo `service`, tenant, Organization, Workspace, consumer, módulo e tipo de evento. O adapter OpenFGA real e seus grants/tuples **não foram implementados/provisionados** nesta PR; só o Host com política aprovada poderá fornecer essa dependência. Não reutilizar `FgaPermission` de usuário, que expressa tuple `user:`, como se fosse identidade de serviço.
4. `principalId`: identidade de serviço confiável injetada pelo Host, igual ao ator interno do `TenantEventDispatcher`. O factory não lê headers, frontend ou JWT.

**Semântica:** módulo não ENABLED ou indisponível e falhas transitórias de Control DB/FGA/tenant suspendem a delivery e mantêm o evento recuperável. Organização/workspace inexistente/arquivada, identidade falsa ou negativa explícita da permissão são negados sem executar efeitos; a negativa explícita resulta no estado terminal `dead` da delivery. A operação nunca concede acesso automaticamente após queda de identidade.

**Compatibilidade:** o factory `apps/core-host/src/platform-event-worker-composition.ts` monta, sem executar, os consumidores reais de WhatsApp → Inbox → CRM → Inbox, o publisher e a ponte de ingestão opt-in. Assinaturas fixas:
- `inbox.message-received-v2` consome `whatsapp.message.received.v2`;
- `crm.resolve-person` consome `inbox.participant.observed.v1`;
- `inbox.crm-person-link` consome `crm.person.resolved.v1`.

O evento de revisão `crm.person.review_required.v1` ainda é retido sem consumidor operacional. O factory retorna `bridge` e `dispatcher`, sem ativá-los no NestJS; o WhatsApp HTTP legado continua intacto. **Não iniciar ambos os projetores do mesmo inbound** e não acoplar um cron sem staging, single projector cutover e controle de backlog.

## Testes

- `platform-event-worker-admission.test.mjs`: serviço obrigatório, tenant/org/workspace, módulo ENABLED antes de ler tenant/FGA, negativa e falhas temporárias.
- `platform-event-worker-admission-pg17.test.mjs`: PostgreSQL 17 descartável, dois tenant databases, dispatcher real, suspensão/retry, recovery, FGA mock explícito, archive de Organization/Workspace e cross-tenant.
- `platform-event-worker-control-pg17.test.mjs`: Control DB **real em PG17 descartável**, `PgModuleCatalog/PgModuleLifecycle/PgEffectiveModuleAccess`, release approved/attested/ENABLED, tenant B não habilitado, dependência CRM desabilitada, entitlement vencido, release descontinuada e outage.
- `platform-events-whatsapp-crm-pg17.test.mjs`: composição real monta três consumers, ingressa e realiza a cadeia vertical, sem criar scheduler ou alterar o caminho operacional.

**Importante:** o Control DB real foi testado em fixture, mas a autorização FGA continua simulada por porta em testes. Não declarar gate FGA de produção aprovado. A autorização é verificada antes do efeito, não uma garantia global de atomicidade entre Control DB, OpenFGA e tenant DB; políticas de revogação/cancelamento e janela de lease devem ser homologadas no estágio real.

## Gates ainda bloqueados

1. Evidência de backup e restore operacional em ambiente segregado, com autorização, RTO/RPO, IAM e custos; ensaio sintético PR #88 não substitui.
2. Aplicação segura e autorizada das migrations Control 001–006 e tenant `platform_events` 001–002 em staging.
3. Provisionamento de service principal/role e política OpenFGA real de processamento, com testes de revogação e isolamento. Nenhum `allow all`.
4. Runtime scheduler/tenant discovery, circuit breaker/observabilidade e limite de backlog, com feature gate apenas do Host.
5. Cutover WhatsApp textual de um único projetor e rollback sem duplicação; homologação final de CRM/Inbox/Frontend.

**Estados:** código no main e testes locais não significam deploy, worker em execução ou Product Gate.
