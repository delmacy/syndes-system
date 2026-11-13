# I04 — PostgreSQL | Referência técnica

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline `origin/main` SHA `13955974bc0702f4c7fcb5717ee2d7cb243f5f08`, inspeção somente leitura do PostgreSQL **DevServer01**. Não foi consultado conteúdo pessoal de clientes nem executado DDL/DML, migration, backup, restore ou modificação de container. **Staging e produção não verificados.**

## Stack e ownership

**PostgreSQL 17**, Docker Compose, bancos separados por função e por tenant, roles isoladas, secrets por arquivo e SQL versionado. I04 é infraestrutura, **não possui package.json, frontend, APIs HTTP, classes NestJS ou eventos de negócio próprios**. Os dados de domínio e providers SQL pertencem a seus módulos.

| Recurso | Fonte de contrato | Conclusão |
|---|---|---|
| Instância PostgreSQL | [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) | `postgres:17-bookworm`, volume `postgres_data`, healthcheck `pg_isready`, sem porta DB publicada no Compose |
| Segurança e redes | Compose e [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md) | `syndes-data`, `syndes-master-data`, SCRAM para host, secret files; saúde e firewall dependem da operação |
| Bootstrap de DBs | `infra/postgres/bootstrap/00-init.sh`, `control.schema` | Três databases técnicos separados, registry/membership; init em volume novo |
| Provisionamento | `infra/postgres/bootstrap/provision-tenant.sh` | UUID canônico → role/DB individual, `REVOKE CONNECT PUBLIC`, `tenant_registry.state=provisioned` |
| Migrations Control | [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) | Plano/aplicação com SHA/checksum, PG17, ledger e autorização; **`--plan` executado, seis PENDING** |
| Migrations Tenant | `infra/postgres/bootstrap/migrate-modules-tenant.sh`, `tenant-module-ledger.schema` | Imagem por `@sha256`, mapping verificado e ledger de execução privado; **não executado** |
| Persistência de módulos | `modules/{core-crm,inbox,whatsapp,organizations,support,service-management}/sql` | Contratos SQL de cada owner, não instalações comprovadas no tenant examinado |
| Event Bus | `apps/core-host/sql/001_platform_events.sql`, `002_event_type_version_consistency.sql`, Control `control-module-events.schema` | Schemas/objetos planejados por banco distintos; workers opt-in sob gates |

## Inventário físico observado — DevServer01

Consultas em transações `BEGIN READ ONLY` às **views de catálogo do próprio PostgreSQL** e grants; nomes/UUID de tenants e dados de negócio não foram emitidos.

| Item | Resultado |
|---|---|
| Servidor | PostgreSQL **17**, container principal `healthy` no momento da observação |
| Bancos previstos | `syndes_control`, `syndes_keycloak`, `syndes_openfga`: **presentes** |
| Bancos tenant | **1 database** com padrão `syndes_tenant_<uuid>`; **1 database adicional não categorizado** (nome não divulgado) |
| Roles | `syndes_core`, `syndes_master_api` e uma role tenant presentes; tenant não superuser/CREATEDB/CREATEROLE |
| `PUBLIC CONNECT` | **Revogado** nos três DBs técnicos e no tenant canônico |
| Proteção tenant | `syndes_core` e `syndes_master_api` **sem CONNECT** nesse DB; role dedicada é owner |
| Core Control | `tenant_registry` e `tenant_memberships` presentes; `syndes_core` tem SELECT, mas não INSERT/UPDATE em registry nem DELETE em memberships |
| Manager Control | `platform_operator_access` e `platform_tenant_profiles` presentes; `syndes_master_api` tem SELECT no registry/perfis e **não INSERT/UPDATE/DELETE** nos perfis |
| Catálogo/lifecycle Control | `module_catalog`, `module_catalog_versions`, `tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit`: **ausentes** |
| Ledger das migrations Control | `public.control_module_schema_migrations`: **ausente** |
| Outbox Control | `control_events.outbox_events`, `event_deliveries`, `consumer_inbox`: **ausentes** |
| Ledger/módulos do tenant | Schema `_syndes` e schemas `crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service`, `platform_events`: **não encontrados** no DB tenant canônico |
| Verificação oficial | `python3 scripts/control/module_migrations.py --plan`: **001–006 PENDING**, mensagem **PLAN ONLY** |

**Limite:** esse resultado descreve apenas os bancos e objetos catalogados nessa instância e naquele instante. Um container `healthy` não prova saúde funcional do CRM/Inbox, e a ausência de schema em um DB canônico não demonstra que nenhum outro ambiente ou host contenha o módulo.

## Scripts, funções, entradas e efeitos

| Assinatura / interface | Owner | Efeito ou contrato |
|---|---|---|
| `00-init.sh` | I04 | Cria roles e DBs iniciais; somente primeira inicialização de volume |
| `provision-tenant.sh`: `TENANT_ID`, `TENANT_DB_PASSWORD` | C02/I04 | Role/DB/registro `provisioned` por UUID, sem ativação ou FGA |
| `scripts/control/module_migrations.py:release_files()` | C01/C02 | Lista fixa 001–006 com SHA-256 dos SQL versionados |
| `inventory(container)` / `reconcile(container,migrations)` | C01/C02 | Consulta catálogo/ledger, recusa checksum drift, objetos sem histórico, ordem inválida |
| `main() --plan` | C01/C02 | **Somente leitura** da situação de migrations; na coleta: todas pendentes |
| `main() --apply` | C01/C02 | **Mutação não autorizada nesta passagem:** transação, advisory lock, SHA e evidência de backup/restore obrigatórios |
| `migrate-modules-tenant.sh` | C02/A04 | Imagem pinned `@sha256`, consulta mapping Control e executa SQL por role de tenant |
| `support-migration-gate.sh` | P06/C02 | Garante tenant operacional aprovado para migrations Support |
| `tenant-module-ledger.schema` | C02 | `_syndes.module_migrations` com PK de módulo/migration, checksum e digest |
| `tests/platform/postgres-smoke.sh` | Q01/I04 | CI descartável: roles/isolamento, tenant idempotente e `pg_dump`/restore **sintético** |

Não confundir funções do **migrador de operador** com endpoints públicos. Scripts de provisioning e manutenção são interfaces privadas. O site público não publica valores de secrets, DSNs, nomes reais de tenants, dados de usuários nem comandos de aplicação de migration.

## Contratos de banco por owner

### Control Plane: database `syndes_control`

- `public.tenant_registry(tenant_id,database_name,role_name,state,created_at)`.
- `public.tenant_memberships(tenant_id,principal_id,state)`.
- `public.platform_operator_access` e `platform_tenant_profiles` para Manager, com grants específicos.
- `public.module_catalog*`, `tenant_module_entitlements/installs/audit`, `control_events.*` definidos no Git, mas **não instalados no Control examinado**.
- Control Plane não deve armazenar mensagens, conversas, anexos ou dados de CRM do tenant.

### Tenant database: `syndes_tenant_<uuid>`

- Cada tenant é criado com role própria `syndes_t_<uuid>` e `PUBLIC CONNECT` revogado; no único DB canônico observado, core/manager também não tinham CONNECT.
- SQL de `crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service` pertence aos módulos, sem presumir execução.
- O ledger de migration `_syndes.module_migrations` é **protegido contra runtime role**, conforme contrato versionado, mas não estava criado no DB consultado.
- A outbox de tenant usa `platform_events` e depende do instalador/worker sob gates próprios.

### Bancos técnicos e armazenamento externo

`syndes_keycloak` e `syndes_openfga` são databases separados. OpenBao **não usa PostgreSQL**: mantém Raft próprio. Komodo usa MongoDB na stack de administração; nenhum deles vira tenant DB por associação.

## Evidências e limites

- **CI baseline:** [GitHub Actions 43355545663](https://github.com/delmacy/syndes-system/actions/runs/43355545663), 24/24 `success` no SHA `1395597`. Testes de integração/restore descartáveis **não** provam aplicação das migrations no DevServer01.
- **Validação não destrutiva local:** leitura de SQL/Compose, `bash -n` de scripts, `py_compile` e plano Control `--plan`. Não executar `--apply`, `migrate-modules-tenant.sh`, `provision-tenant.sh` ou `postgres-smoke.sh` em host persistente.
- **Pendências:** reconciliar Control schema/migrator, classificar DB adicional, identificar finalidade do tenant canônico, comprovar backup/restore real, A/B de API e staging/produção.
- **WBS histórica:** 10.02 (PEND), 10.07/40.02/40.08/60.02/60.03 BLOQ, 55.03 sob gate parcial — sem promoção nesta auditoria.

[Escopo e diagramas](ESCOPO.md) · [STATUS](STATUS.md) · [Operação segura](OPERACAO.md) · [WBS](EVOLUCAO.md).
