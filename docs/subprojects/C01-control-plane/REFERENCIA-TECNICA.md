# C01 — Control Plane | Referência técnica

> **AUDITORIA ESTÁTICA E SQL SOMENTE LEITURA — 13/11/2026.** Base `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`. Snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **C01 é uma fronteira distribuída de dados/contratos globais, não um serviço isolado.** Não foram consultados dados pessoais nem executados migrations, grants, escrita, restore ou deploy. Produção e staging não verificados.

## Stack, source of truth e ownership

| Camada | Fonte verificável | Responsabilidade/limite |
|---|---|---|
| C01 | `infra/postgres/bootstrap/control.schema`, `control-admin.schema`, `control-module-*.schema`, `control-account-*.schema` | PostgreSQL 17 `syndes_control`: tenant registry/membership, metadados de Manager, catálogo/release/entitlement de módulo |
| I04 | `infra/postgres/compose.yaml`, `00-init.sh`, `provision-tenant.sh` | Servidor/DB/role, segurança de conexão e volumes; **não** decisão de autorização do produto |
| C02 | `scripts/control/module_migrations.py`, `infra/postgres/bootstrap/migrate-modules-tenant.sh` | Installer/operador de migrations; somente com release SHA, backup/restore, checksum e gates |
| A08 | `packages/core-kernel/src/module-catalog.ts`, `module-lifecycle.ts`, `module-access.ts`, `control-plane-events.ts` | Portabilidade e envelopes tipados; não um SDK npm público |
| A04 | `apps/core-host/src/module-catalog.ts`, `module-lifecycle.ts`, `module-effective-access.ts`, `module-installer.ts` | Adapters PostgreSQL, readmodels, gates opt-in e installer trusted |
| A05 | `apps/master-admin-api/src/server.mjs`, `modules/tenant-module-inventory.mjs` | HTTP read-only de metadados, com JWT/allowlist e role própria; sem tenant DB |
| A06 | `apps/account-access-api/src/server.mjs`, `main.mjs` | Delegação de roles de Account com FGA; contrato SQL `control-account-delegation.schema` |
| C06 | `infra/postgres/bootstrap/control-module-events.schema`, `apps/core-host/src/platform-event-*.ts` | Eventos de administração em Control separados dos eventos de domínio em tenant |

**C01 não tem `package.json`, classes HTTP, frontend ou APIs próprios em `infra/postgres/bootstrap`.** As classes e métodos abaixo pertencem aos owners citados e foram confrontados com arquivos reais, não atribuídos ficticiamente à C01.

## Catálogo SQL — observado versus versionado

| Banco e objeto | Origem no Git | Resultado no Control DevServer01 |
|---|---|---|
| `public.tenant_registry`, `public.tenant_memberships` | `control.schema` | **PRESENTES** — um tenant com `state=active` no registry (sem divulgar UUID) |
| `public.platform_operator_access`, `public.platform_tenant_profiles` | `control-admin.schema` | **PRESENTES** |
| `public.tenant_account_role_grants`, `tenant_account_role_audit` | `control-account-roles.schema` | **AUSENTES** |
| `public.module_catalog`, `module_catalog_versions`, `module_catalog_dependencies` | `control-module-catalog.schema` | **AUSENTES** — stage 001 |
| `public.tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit` | `control-module-lifecycle.schema` | **AUSENTES** — stage 002 |
| Funções/roles de atestado, ativação | `control-module-attestation.schema`, `control-module-activation.schema` | **003–004 PENDING**; roles module operator/installer/activator ausentes |
| Grants Manager de inventário de módulo | `control-module-manager-readonly.schema` | **005 PENDING** |
| `control_events.outbox_events`, `event_deliveries`, `consumer_inbox` | `control-module-events.schema` | **AUSENTES** — stage 006 |
| `public.control_module_schema_migrations` | `scripts/control/module_migrations.py` | **AUSENTE**; seis stages PENDING via `--plan` |

### Grants observados

- `syndes_core`: **SELECT** no registry/memberships; sem `INSERT` no registry.
- `syndes_master_api`: **SELECT** no registry/perfis; sem `INSERT` ou `UPDATE` nas tabelas de perfis consultadas.
- Roles `syndes_module_operator`, `syndes_module_installer`, `syndes_module_activator`: **ausentes** no snapshot.
- `PUBLIC CONNECT` ao `syndes_control` revogado conforme I04. Isso **não** comprova políticas FGA, segurança HTTP de todas as APIs ou isolamento em outros hosts.

## Classes, métodos e APIs por owner (não C01)

| Proprietário | Símbolo/endpoint real | Comportamento e limite |
|---|---|---|
| A08 Kernel | `ModuleCatalogPort.listAvailableForTenant`, `resolveApprovedModules` | Versões aprovadas presentes no build confiável, sem confundir com entitlement |
| A08 Kernel | `TenantModuleLifecyclePort.listModuleStates`, `projectTenantModuleStates` | Readmodel de estados independentes, não autoriza acesso |
| A08 Kernel | `ModuleAccessPort.canExecuteModule` | Port de gating opt-in usado via `CoreKernel.executeModule` |
| A04 Host | `PgModuleCatalog.listAvailableForTenant()` | `JOIN` com `module_catalog*` (não instalado nesta instância) |
| A04 Host | `PgModuleLifecycle.listModuleStates()` | `SELECT` de entitlements/instalação, ausentes no DevServer |
| A04 Host | `PgEffectiveModuleAccess.canExecuteModule()` | Retorna **false em erro de schema/Control**; não garante que todos os controllers apliquem o gate |
| A04 Host | `PgModuleInstaller`, `PgControlInstallAttestor`, `PgControlModuleActivator` | Contratos de operação trusted, não endpoints de provisionamento público |
| A05 Manager | `GET /v1/platform/admin/me`, `/summary`, `/tenants`, `/tenants/:id` | JWT, allowlist `platform_operator_access`, metadados read-only |
| A05 Manager | `GET /v1/platform/admin/tenants/:id/modules` | Consulta catálogo/entitlements/installs; tabelas ausentes **podem causar 503** (código trata erro); sem teste HTTP live |
| A06 Account | `POST` de delegação de papéis por conta no prefixo `/v1/accounts/` | JWT/FGA e função de SQL de delegação; SQL Account não instalado no Control auditado |

### Eventos administrativos versionados

O `control-plane-events.ts` do Kernel define **dois envelopes v1**: `platform.module.entitlement.changed.v1` e `platform.module.installation.changed.v1`. O `control-module-events.schema` escreve outbox através do trigger `control_events.enqueue_module_audit()` após INSERT no log append-only `tenant_module_audit`, mantendo o mesmo commit PostgreSQL. `event_deliveries` e `consumer_inbox` dão suporte a tentativas, leases e idempotência no schema **Control**.

Essa infraestrutura consta do **SQL versionado**, mas foi constatado que o schema `control_events` não está instalado na instância. **Nenhum dispatcher Control foi homologado ou ativado por este trabalho.** A outbox tenant-local de CRM/Inbox/WhatsApp em `platform_events` possui owner e gates separados.

## Migrador Control — seis etapas pendentes

O migrador `scripts/control/module_migrations.py` foi executado **somente com `--plan`**, registrando:

| Etapa | Contrato | DevServer01 |
|---|---|---|
| 001_catalog | Catálogo, versões, deps | PENDING |
| 002_lifecycle | Entitlements/installs/audit | PENDING |
| 003_attestation | Verificação do instalador | PENDING |
| 004_activation | Ativação de módulo | PENDING |
| 005_manager_readonly | Inventário Manager | PENDING |
| 006_control_events | Outbox Control | PENDING |

O runner valida alvo `syndes_control`, PG17, checksum SHA-256, migrações sequenciais, histórico e autorização, e recusa drift. Aplicação exige SHA da release, backup e ensaio real de restore, além de acknowledgement e aprovação do operador. **A auditoria não executou `--apply`.**

## Evidências, bloqueios e navegação

- **SQL real (13/11/2026):** leitura agregada dos catálogos `pg_roles`, `pg_database` e `pg_class`, transação `BEGIN READ ONLY`, sem linhas/UUIDs de clientes.
- **CI da baseline:** [Syndes Mainline CI 43359636260](https://github.com/delmacy/syndes-system/actions/runs/43359636260), **24/24 success** no SHA `ac8deb8` (fixtures e serviços descartáveis), **não** homologação de runtime Control.
- **WBS:** [EVOLUÇÃO](EVOLUCAO.md) e [CP-E/CP-G](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md): CP-G01/02 bloqueados, CP-G03 pendente.
- **Diferença fundamental:** **um tenant `active` em registry não significa entitlement, install, ENABLED, API funcional ou worker**.

[Especificação](ESCOPO.md) · [STATUS](STATUS.md) · [Operação e gates](OPERACAO.md).
