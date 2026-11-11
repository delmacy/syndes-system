# ADR — Control Plane Module Events via audit transacional (2026-11-11)

**Estado:** implementação de fonte/ledger tipada e migration **candidata**, testada em PostgreSQL 17 **descartável**, sem aplicação no `syndes_control` operacional. Nenhum dispatcher de controle ativado.

## Contexto e decisão

O Control Plane possui `public.tenant_module_audit` append-only, preenchido pelas transições de entitlement, intenção de instalação, attestation e ativação. Em vez de criar comandos concorrentes, a migration versionada **006_control_events** instala um trigger `AFTER INSERT` na auditoria. O trigger insere o fato em `control_events.outbox_events` **no mesmo COMMIT** que a transição do módulo; falha do outbox provoca rollback de estado e auditoria. Repetição de `request_id` já registrada não cria nova auditoria nem evento.

**Não confundir schemas:**
- `syndes_control.control_events` recebe **apenas fatos administrativos globais** do Control Plane (mesmo banco de controle, com tenant como assunto do evento).
- `syndes_tenant_*.platform_events` recebe **eventos de negócio tenant-local**, sempre dentro do seu database. Nenhuma fila compartilhada de WhatsApp/Inbox/CRM é criada no controle.

## Contratos v1 (Core Kernel)

- `platform.module.entitlement.changed.v1`, produtor `module_lifecycle`, fonte `tenant_module_audit.operation='entitlement.*'`.
- `platform.module.installation.changed.v1`, mesmo produtor, fonte `operation='installation.*'` (inclui request, attestation, enable/disable, suspension/retirement).

O envelope tem `event_id` UUID, `audit_event_id` BIGINT, `tenant_id`, `module_id`, `event_type`, `event_version`, `operation`, `result_state`, `correlation_id=request_id`, `created_at` e `payload={auditEventId:'decimal'}`. O payload nunca replica o ator, a justificativa, segredo, body de mensagem, JID ou dados pessoais. Referência exata e completa fica na tabela audit existente.

`packages/core-kernel/src/control-plane-events.ts` oferece tipos `ControlPlaneModuleEvent` e `validateControlPlaneEvent`, com validação de tipo/operação/estado/UUID/BIGINT. A versão 1 do fato não confere autorização para executá-lo.

## Consistência e restrições

- FK composta `(audit_event_id,tenant_id,module_id)` garante que ninguém associe um evento a outro tenant ou módulo da auditoria; índice único aditivo no audit ledger.
- `control_events.outbox_events` é único por `audit_event_id`, contém índices de pendência e versão vinculada ao nome do contrato.
- `control_events.event_deliveries` possui tentativas, backoff programável, lease/owner, estados pendente/retry/suspended/completed/dead.
- `control_events.consumer_inbox` é único por evento e consumidor, para efeitos futuros idempotentes.
- O migration runner `scripts/control/module_migrations.py` incorpora `006_control_events` **após** cinco migrations preexistentes, com SHA-256, advisory lock, ledger e abort total em divergência. Permanece somente execução offline explícita; nenhum bootstrap Host ou job operacional foi conectado.
- Schema e tabelas sem grants para `syndes_core`, operator, installer, activator, Manager ou PUBLIC. Nenhuma identidade de runtime para consumir o ledger foi criada.

## Homologação isolada

`apps/core-host/test/control-plane-events-pg17.test.mjs`: PostgreSQL 17 localhost com credencial descartável e flag `EVENTS_TEST_ONLY`, cria um banco `syndes_control` **apenas dentro do contêiner isolado**, aplica schemas candidatos e verifica replay de schema, 1 trigger, commit atômico, replay de comando, diferença entitlement/installation, rollback quando trigger falha, rollback explícito, escopo tenant e FK composto, 2 consumidores no ledger, negação de escrita/leitura a roles comuns e publicação via procedure autorizada sob role restrita. Banco descartável é excluído após os testes. `scripts/control/test_module_migrations.py` valida ordem, SHA, gates e abort.

## Product Gates bloqueados

1. O `syndes_control` real ainda tem as **cinco migrations anteriores não aplicadas**; a 006 é um novo candidato. Não executar qualquer DDL/DML operacional sem backup comprovado e RESTORE testado, SHA autorizado, janela, ACL e rollback.
2. O dispatcher/consumidores do Control Plane (ex.: read model Manager e cache de módulos) **não foram instalados/ativados**. Falta identity de serviço confiável, FGA/ENABLED, descoberta de assinaturas, leases e recuperação/retention operacional; não fabricar JWT de usuário.
3. Não habilitar enforcement de módulos apenas porque existe outbox; estado do Control Plane continua bloqueado até provisionamento e testes ponta a ponta. Não executar replay manual sem auditoria.
4. Sem expurgo automático: reter eventos enquanto não houver backup/arquivamento, critério de terminalidade e política aprovada.

**Status separados:** código candidato/testes PG17 locais ≠ CI verde ≠ PR integrada ao main ≠ migration aplicada ≠ funcionalidade operacional ≠ homologação.
