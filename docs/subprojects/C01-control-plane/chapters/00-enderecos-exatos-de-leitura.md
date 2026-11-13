## 0. Fontes auditadas, SHA e prova de ambiente

> **Auditoria estática + catálogo PostgreSQL somente leitura — 13/11/2026.** Base do checkout `origin/main`: `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`. Snapshot do DevServer01: **2026-11-13T04:38:21Z**. Staging e produção **não verificados**. Não foram lidos registros de clientes nem alterados serviços, bancos, grants ou schemas.

| Fonte | Conteúdo e limite |
|---|---|
| `catalog/work-units.json` — `C01` | Owner `infra/postgres/bootstrap`, maturidade `distributed` (não é deploy) |
| [`infra/postgres/bootstrap/control.schema`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/bootstrap/control.schema) | Tabelas base `tenant_registry`, `tenant_memberships`, grants SELECT do Core |
| [`control-admin.schema`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/bootstrap/control-admin.schema) | Role e tabelas de metadados do Platform Manager |
| `control-account-roles.schema`, `control-account-delegation.schema` | Papéis de conta e função de delegação; **ausentes** da instância examinada |
| `control-module-catalog.schema` | Catálogo, versões aprovadas e dependências — **não instalado no Control examinado** |
| `control-module-lifecycle.schema`, `control-module-attestation.schema`, `control-module-activation.schema` | Entitlements, instalações, auditoria, atestado, transições; dependem do migrador |
| `control-module-manager-readonly.schema` | Grants de inventário de módulos para Manager; stage 005 **pendente** |
| `control-module-events.schema` | Schema `control_events`, trigger audit→outbox e entregas/inbox; stage 006 **pendente** |
| [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) | Runner `--plan`/ `--apply`, ordem 001–006, checksum SHA-256, ledger, validação PG17 |
| `apps/core-host/src/module-catalog.ts`, `module-lifecycle.ts`, `module-effective-access.ts` | Adapters Host/Kernel **não** tabelas do C01 em runtime |
| `apps/master-admin-api/src/server.mjs`, `modules/tenant-module-inventory.mjs` | API somente leitura de metadados; depende de schema de catálogo |
| `apps/account-access-api/src/server.mjs`, `main.mjs` | Delegação de Account com FGA e função SQL (owner A06) |
| `packages/core-kernel/src/module-*.ts`, `control-plane-events.ts` | Ports/interfaces e eventos tipados pertencentes a A08 |
| `tests/platform/*.sh`, `scripts/control/test_module_migrations.py`, testes PG17 Host/Manager | Testes com fixture/CI; **não** migrations executadas no DevServer |
| [WBS Control Events](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md) | CP-E01..E07 disponíveis em código/artefatos; CP-G01..G03 com gates abertos |
| [CI de origem](https://github.com/delmacy/syndes-system/actions/runs/43359636260) | 24/24 jobs aprovados no commit `ac8deb8`, sem homologação do banco |

### Método de observação

Foram consultadas exclusivamente as visões **`pg_roles`, `pg_database`, `pg_namespace` e presença de tabelas/funções** em transações `BEGIN TRANSACTION READ ONLY`, com contagens/flags agregadas. Executado também `python3 scripts/control/module_migrations.py --plan`, sem `--apply`. **Nenhum UUID, principal, payload de evento, DSN ou segredo** foi registrado no portal.

**Atenção:** as páginas são públicas. Não incluir catálogo completo, `pg_dump`, dados individuais, valores de credenciais, IPs, rotas administrativas internas nem detalhes de acesso operacional.
