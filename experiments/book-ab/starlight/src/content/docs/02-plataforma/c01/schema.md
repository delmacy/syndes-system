---
title: "C01 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline de código `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`; snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **Consultas SQL somente leitura, sem dados pessoais ou segredos. Nenhuma migration, grant, role, API, worker, container, backup ou deploy alterado.** Staging e produção não verificados.

> L9: \| **Documentação C01** \| **AUDITORIA PARCIAL:** oito capítulos, reference, contracts, WBS, schema e APIs por owner reconciliados \| Revisão formal e aceite dos responsáveis ainda pendentes \|

> L12: \| **Account roles** \| SQL versionado; `tenant_account_role_grants`, `tenant_account_role_audit` ausentes no DevServer \| A06 e delegação funcional não homologados \|

> L13: \| **Catálogo e releases** \| `module_catalog`, `module_catalog_versions`, `module_catalog_dependencies` **ausentes** \| Consulta Host/Manager depende de schema não instalado \|

> L19: \| **Manager inventário** \| `GET /v1/platform/admin/tenants/:id/modules` existe no código e consulta tabelas ausentes \| **Pode retornar 503** por erro SQL; não testado em HTTP real nesta auditoria \|

> L25: 1. **P0 — Consumer/schema parity:** a API Manager de inventário e os adapters Host consultam tabelas de catálogo/lifecycle que ainda **não existem** no Control do DevServer01. A ausência de objeto SQL não deve ser tratada como lista vazia de módulos.

> L27: 3. **P1 — seis migrations Control pendentes:** stages 001–006 com checksums versionados; ledger ausente e roles de módulos não criadas. **Não aplicar** sem backup, restore, release SHA, owner e Product Gate.

> L28: 4. **P1 — Account roles/delegação ausentes:** tabelas/funções do contrato Account não confirmadas; dependências da A06/FGA reais precisam de gate próprio.

> L29: 5. **P1 — Control events não instalado:** SQL/trigger disponíveis no Git, sem tables/dispatcher/consumer autorizados neste ambiente; tenant outbox é outro plano de dados.

> L38: \| **30.03** \| Account API/SQL delegação \| BLOQ \|

> L49: A sequência correta é revisar os consumers reais e a versão da instalação, obter evidência de backup/restore e aprovação para um plano de migração, realizar ensaios negativos em staging e só então decidir se/como aplicar os schemas. **Esta entrega não abre gate de migration nem modifica dados.**

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA E SQL SOMENTE LEITURA — 13/11/2026.** Base `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`. Snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **C01 é uma fronteira distribuída de dados/contratos globais, não um serviço isolado.** Não foram consultados dados pessoais nem executados migrations, grants, escrita, restore ou deploy. Produção e staging não verificados.

> L9: \| C01 \| `infra/postgres/bootstrap/control.schema`, `control-admin.schema`, `control-module-*.schema`, `control-account-*.schema` \| PostgreSQL 17 `syndes_control`: tenant registry/membership, metadados de Manager, catálogo/release/entitlement de módulo \|

> L11: \| C02 \| `scripts/control/module_migrations.py`, `infra/postgres/bootstrap/migrate-modules-tenant.sh` \| Installer/operador de migrations; somente com release SHA, backup/restore, checksum e gates \|

> L15: \| A06 \| `apps/account-access-api/src/server.mjs`, `main.mjs` \| Delegação de roles de Account com FGA; contrato SQL `control-account-delegation.schema` \|

> L16: \| C06 \| `infra/postgres/bootstrap/control-module-events.schema`, `apps/core-host/src/platform-event-*.ts` \| Eventos de administração em Control separados dos eventos de domínio em tenant \|

> L24: \| `public.tenant_registry`, `public.tenant_memberships` \| `control.schema` \| **PRESENTES** — um tenant com `state=active` no registry (sem divulgar UUID) \|

> L25: \| `public.platform_operator_access`, `public.platform_tenant_profiles` \| `control-admin.schema` \| **PRESENTES** \|

> L26: \| `public.tenant_account_role_grants`, `tenant_account_role_audit` \| `control-account-roles.schema` \| **AUSENTES** \|

> L27: \| `public.module_catalog`, `module_catalog_versions`, `module_catalog_dependencies` \| `control-module-catalog.schema` \| **AUSENTES** — stage 001 \|

> L28: \| `public.tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit` \| `control-module-lifecycle.schema` \| **AUSENTES** — stage 002 \|

> L29: \| Funções/roles de atestado, ativação \| `control-module-attestation.schema`, `control-module-activation.schema` \| **003–004 PENDING**; roles module operator/installer/activator ausentes \|

> L30: \| Grants Manager de inventário de módulo \| `control-module-manager-readonly.schema` \| **005 PENDING** \|

> L31: \| `control_events.outbox_events`, `event_deliveries`, `consumer_inbox` \| `control-module-events.schema` \| **AUSENTES** — stage 006 \|

> L37: - `syndes_master_api`: **SELECT** no registry/perfis; sem `INSERT` ou `UPDATE` nas tabelas de perfis consultadas.

> L50: \| A04 Host \| `PgEffectiveModuleAccess.canExecuteModule()` \| Retorna **false em erro de schema/Control**; não garante que todos os controllers apliquem o gate \|

> L53: \| A05 Manager \| `GET /v1/platform/admin/tenants/:id/modules` \| Consulta catálogo/entitlements/installs; tabelas ausentes **podem causar 503** (código trata erro); sem teste HTTP live \|

> L54: \| A06 Account \| `POST` de delegação de papéis por conta no prefixo `/v1/accounts/` \| JWT/FGA e função de SQL de delegação; SQL Account não instalado no Control auditado \|

> L58: O `control-plane-events.ts` do Kernel define **dois envelopes v1**: `platform.module.entitlement.changed.v1` e `platform.module.installation.changed.v1`. O `control-module-events.schema` escreve outbox através do trigger `control_events.enqueue_module_audit()` após INSERT no log append-only `tenant_module_audit`, mantendo o mesmo commit PostgreSQL. `event_deliveries` e `consumer_inbox` dão suporte a tentativas, lease

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/OPERACAO.md)

> L3: > **RUNBOOK DE CONSULTA, NÃO DE IMPLANTAÇÃO.** A auditoria C01 de 13/11/2026 examinou somente catálogo de PostgreSQL e código versionado. Não autoriza DDL, migrations, grants, workers ou leitura de dados pessoais.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L43: No snapshot de 13/11/2026, informou **seis migrations PENDING** e `PLAN ONLY: no Control DB changes`; não criou ledger ou schema. A auditoria de catálogo usou `BEGIN TRANSACTION READ ONLY` e agregados sem UUID, principal, evento, PII, tokens ou credenciais.

> L45: Antes de qualquer alteração, exigir: comparação de runtime/consumer com schema realmente implantado; owners C01/I04/C02/A04/A05/C06; backup real e restore isolado ensaiado; checksum/SHA da release; janela e reversão; grants e testes negativos A/B; gate explícito. Não usar essa documentação como autorização operacional.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **C01 não é um pacote com `export` próprio nem um serviço HTTP específico.** As APIs reais pertencem a A04/A05/A06 e as interfaces portáveis pertencem a A08. O contrato primário do C01 é o **schema Control versionado e suas regras de transição**.

> L9: \| `control.schema` \| `public.tenant_registry(tenant_id,database_name,role_name,state)` \| Registry global; **presente**, 1 tenant `active` no DevServer \|

> L10: \| `control.schema` \| `public.tenant_memberships(tenant_id,principal_id,state)` \| Membership global; **presente**, com SELECT para `syndes_core` \|

> L11: \| `control-admin.schema` \| `platform_operator_access` e `platform_tenant_profiles` \| Metadados e role `syndes_master_api` somente leitura; **presentes** \|

> L12: \| `control-account-roles.schema` \| `tenant_account_role_grants`, `tenant_account_role_audit` \| Tabelas **ausentes** na instância examinada \|

> L13: \| `control-account-delegation.schema` \| `apply_tenant_account_delegation` \| Função versionada para A06; disponibilidade **não foi comprovada em runtime** \|

> L14: \| `control-module-catalog.schema` \| `module_catalog`, `module_catalog_versions`, `module_catalog_dependencies` \| Staged 001, **ausentes** \|

> L15: \| `control-module-lifecycle.schema` \| `tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit` \| Stage 002; transições auditadas, **ausentes** \|

> L16: \| `control-module-attestation.schema` \| Roles/funções de atestado de instalação \| Stage 003 **PENDING** \|

> L17: \| `control-module-activation.schema` \| Funções de habilitação/revogação \| Stage 004 **PENDING** \|

> L18: \| `control-module-manager-readonly.schema` \| Grants de leitura de módulo para Manager \| Stage 005 **PENDING** \|

> L19: \| `control-module-events.schema` \| `control_events.outbox_events`, `event_deliveries`, `consumer_inbox`, trigger \| Stage 006 **PENDING** \|

> L26: \| **A05** `apps/master-admin-api/src/server.mjs` \| `GET /v1/platform/admin/me`, `/summary`, `/tenants`, `/tenants/:id`, `/tenants/:id/modules` \| JWT e allowlist de operador; `/modules` depende de tabelas **ausentes** e tende a 503 em caso de erro SQL — **sem teste HTTP real neste host** \|

> L27: \| **A06** `apps/account-access-api/src/server.mjs` \| POST restrito de delegação de roles de conta, com JWT/FGA \| Depende das funções/tabelas Account ainda não instaladas no Control observado \|

> L28: \| **A04** `PgModuleCatalog.listAvailableForTenant()` \| Consulta releases aprovadas; somente build trusted e tenant `active` \| SQL referência `module_catalog` ausente no DevServer; não é entitlement \|

> L29: \| **A04** `PgModuleLifecycle.listModuleStates()` \| Estado agregado de entitlement/instalação \| SQL de módulo ausente; projection não é autorização \|

> L33: **API Manager de inventário:** `apps/master-admin-api/src/modules/tenant-module-inventory.mjs` consulta `module_catalog_versions`, `tenant_module_entitlements` e `tenant_module_installs`; sanitiza a resposta para **não expor schema, DB role, digest ou secret**. Ausência dessas tabelas no Control observado implica falha na consulta, não representação de módulos disponíveis.

> L39: - **Entrega:** `control_events.event_deliveries` com lease, retry, dead/suspended; `control_events.consumer_inbox` para idempotência por consumer. Fonte SQL está no repositório, mas **não instalada neste Control**.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L59: O estado `active` encontrado para um tenant no registry é **somente estado administrativo**. Não significa que catálogo/entitlements, schemas do tenant ou FGA estejam aptos; o DevServer01 não tem as tabelas da cadeia de módulo.

> L78: `control_events` foi projetado com outbox, delivery e inbox no **banco Control**, recebendo dados de `tenant_module_audit` na mesma transação. Esse schema contém fatos administrativos de entitlement/instalação, não mensagens. Por outro lado, `platform_events` é schema do **tenant DB**, para eventos dos módulos. A disponibilidade de contrato v1 ou teste PG17 sintético não autoriza dispatcher/control worker ou envio de

> L82: - **Control DB:** `syndes_control`, conexão de runtime somente leitura para `syndes_core` e `syndes_master_api` em objetos específicos; nenhuma publicação de porta SQL via Compose.

> L85: - **Backup e recuperação:** ausência de migração e ledger no runtime **não é justificativa para aplicar SQL** sem restore real da versão implantada. Staging e produção permanecem não verificados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
