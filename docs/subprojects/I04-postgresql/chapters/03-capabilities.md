## 3. Capabilities implementadas, observadas e planejadas

### Estado observado — DevServer01, 13/11/2026

| Categoria | Evidência de catálogo/arquivo | Interpretação |
|---|---|---|
| Versão e instância | PostgreSQL **17** em container principal `healthy` (Docker) | Serviço em execução; não é prova de backup nem latência |
| Databases técnicos | `syndes_control`, `syndes_keycloak`, `syndes_openfga` **presentes** | DBs distintos; objetos internos de Keycloak/FGA não auditados |
| Databases tenant | **1 DB com nome canônico** e **1 outro DB fora das categorias verificadas** | Objetivo/proprietário do DB adicional não verificados; não publicar nome |
| Roles | `syndes_core`, `syndes_master_api`, **1 role tenant** | Role core não é superuser; role tenant sem superuser/CREATEDB/CREATEROLE |
| Acesso aos DBs de sistema | `PUBLIC CONNECT=false` nos três | Negativa de CONNECT, não de todos os privilégios |
| Isolamento do tenant observado | `PUBLIC`, `syndes_core`, `syndes_master_api` sem CONNECT | Owner coincide com role dedicada; **não comprova FGA/membership API** |
| Control base | `tenant_registry`, `tenant_memberships` presentes, core com SELECT | Contrato base de tenancy observado |
| Manager Control | `platform_operator_access`, `platform_tenant_profiles` presentes | Algum SQL do Manager aplicado; frontend completo não auditado |
| Módulos no Control | `module_catalog`, `module_catalog_versions`, `tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit` **ausentes** | SQL versionado, não instalado no Control auditado |
| Eventos Control | `control_events.outbox_events`, `event_deliveries`, `consumer_inbox` **ausentes** | Schema Control events não observado |
| Tenant DB observado | Sem schemas `crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service`, `platform_events`, `_syndes` | DB com nome canônico pode estar somente provisionado; não inferir que produto esteja instalado |
| Migrador Control | `python3 scripts/control/module_migrations.py --plan` | **6 migrations PENDING**, saída `PLAN ONLY`, nenhum DDL executado |

### Migrações de módulos efetivamente presentes no Git

| Owner | Fontes versionadas | Uso |
|---|---|---|
| Control (C01/C02/C06) | `infra/postgres/bootstrap/control-module-*.schema` e `scripts/control/module_migrations.py` | Catálogo, lifecycle, attestation, activation, manager read-only e Control events |
| Admin global (A05) | `control-admin.schema`, `control-account-roles.schema`, `control-account-delegation.schema` | Operador, perfil, papéis e delegação |
| Tenant ledger (C02/A04) | `tenant-module-ledger.schema` | Histórico com checksum/digest protegido por schema `_syndes` |
| CRM | `modules/core-crm/sql/001–003` | Dados CRM e relações |
| Inbox | `modules/inbox/sql/001` | Conversas e atribuições |
| WhatsApp | `modules/whatsapp/sql/001–008` | Canal, mensagens, histórico, projeções e recibos |
| Organizations | `modules/organizations/sql/001–007` + script `manual/` | Contexto organizacional, integridade e gate manual multi-org |
| Support | `modules/support/sql/001` | Casos de suporte no tenant operacional |
| Service Management | `modules/service-management/sql/001–003` | Funis, transferências e visualização de conversa |
| Event Platform tenant | `apps/core-host/sql/001–002` | Eventos/consumers em schema `platform_events` |

**Atenção:** os números representam artefatos versionados, **não migrations aplicadas ao DevServer01**. Testes em Postgres descartável podem comprovar schema e isolamento de um fixture sem alterar o servidor da plataforma.

### Lacunas não resolvidas

- Inventário de um DB adicional fora das categorias conhecidas, sem inspeção de nomes/dados.
- Discrepância entre migrations Control versionadas e 6 pendências em `--plan`.
- Tenant canônico provisionado sem schemas dos módulos analisados; é possível que não seja o tenant de uma release operacional.
- Sem evidência de testes de backup/restore **no ambiente persistente**, retenção, RPO/RTO, failover ou auditoria de grants de todas as roles.
- Conector de `server02`/`win1-server` offline, sem diagnóstico de outras instâncias PostgreSQL.
