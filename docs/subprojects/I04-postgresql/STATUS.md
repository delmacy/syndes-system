# I04 — PostgreSQL | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline Git `13955974bc0702f4c7fcb5717ee2d7cb243f5f08` (`origin/main`); DevServer01 acessado por conector autorizado. **Foram realizadas somente consultas aos catálogos PostgreSQL, conferência de grants e `--plan` do migrador Control, sem DDL, DML, mudança operacional, dump, restore nem leitura de dados pessoais.** Outros hosts, staging e produção **não verificados**.

## Matriz de estado e evidências

| Dimensão | Resultado comprovado | Limites |
|---|---|---|
| **Documentação I04** | **AUDITORIA PARCIAL:** SQL/Compose, contratos, 8 capítulos, bancos/roles/grants, diagrama e WBS reconciliados | Ratificação pelos owners/DBA pendente |
| **Instância DevServer01** | PostgreSQL **17**, container principal `healthy`; três DBs técnicos previstos presentes | `healthy` não valida restauração, produto, TPS nem todos os providers |
| **Tenancy física** | **1 DB de tenant canônico** e role exclusiva observados; mais **1 DB adicional não categorizado** | Finalidade dos DBs não confirmada sem consulta autorizada de mapping |
| **Isolamento de CONNECT** | `PUBLIC` sem CONNECT nos DBs técnicos e tenant; `syndes_core` e `syndes_master_api` sem CONNECT no tenant; role tenant sem superuser, CREATEDB ou CREATEROLE | Não comprova negação de API, FGA ou todo tenant futuro |
| **Control mínimo** | `tenant_registry`, `tenant_memberships` presentes, SELECT do core; Manager com perfil/operador e SELECT, sem DML de perfis | Tabelas adicionais do Control não necessariamente instaladas |
| **Módulos Control** | `module_catalog`, versions, entitlements, installs, audit **ausentes** | Código disponível; estado de instalação não comprovado |
| **Eventos Control** | `control_events` outbox/deliveries/inbox **ausentes** | Nenhum worker pode ser considerado habilitado por documentação |
| **Control migration ledger** | `public.control_module_schema_migrations` **ausente**; migrador oficial **6 PENDING** via `--plan` | Não executar `--apply` sem backup/restore, SHA e owner |
| **Tenant DB observado** | Sem schemas de CRM, Inbox, WhatsApp, Organizations, Support, Service, `platform_events` ou ledger `_syndes` | Pode ser tenant apenas `provisioned`; ausência não é falha funcional demonstrada |
| **CI descartável** | [Run 43355545663](https://github.com/delmacy/syndes-system/actions/runs/43355545663): **24/24 jobs success** no SHA `1395597` | Suítes PG17/restore sintéticas, não release/staging |
| **Backup/restore operacional** | Arquivos e scripts encontrados, nenhum restore do volume persistente executado | **NÃO VERIFICADO** |
| **Produção/staging** | Nenhum host ou banco correspondente inspecionado | **NÃO VERIFICADO** |

## Divergências prioritárias para engenharia

1. **P0 — Plano de migrations Control: seis etapas pendentes.** `scripts/control/module_migrations.py --plan` informou `001_catalog`, `002_lifecycle`, `003_attestation`, `004_activation`, `005_manager_readonly`, `006_control_events` como PENDING. Há objetos Manager base presentes, mas nenhuma dessas seis migrações aparece aplicada. **Não presumir que o Host esteja apto a operar o catálogo/eventos.**
2. **P1 — Tenant existente sem schema de negócio/ledger.** Um DB de tenant canônico está provisionado, porém faltam `crm/inbox/whatsapp/organizations/support/service/platform_events/_syndes`. Verificar finalidade e estado antes de instalar; o gateway ou Host em execução não comprova a presença desse schema.
3. **P1 — Database adicional sem classificação operacional.** Mais um banco não corresponde aos padrões de sistema e tenant auditados. Identificar owner e lifecycle sem divulgar seu nome.
4. **P1 — Teste de isolamento incompleto.** `CONNECT` e grants básicos estão restritivos no banco examinado, mas falta matriz SQL completa e teste API/authorization A/B contra providers reais.
5. **P1 — Backup e reversibilidade desconhecidos.** `pg_dump` de fixture em CI não substitui restore de Control+tenants com RPO/RTO, rollback e papéis.
6. **P1 — Outros hosts não inspecionados.** `server02`/`win1-server` offline no conector na coleta; não inferir estado de staging/produção.

## WBS preservada — nenhum status promovido

| ID | Tarefa de origem | Estado histórico |
|---|---|---|
| **10.02** | Revisar roles PostgreSQL e grants | PEND |
| **10.07** | Plano backup/restore de Control e tenants | BLOQ (operação) |
| **40.02** | Provisionar Syndes como tenant | BLOQ |
| **40.08** | Migrations tenant Syndes + backup/restore | BLOQ |
| **55.03** | Installer, canonicidade e schema/gates | API opt-in/PG17 sintético; Control/restore/FGA reais BLOQ |
| **60.02** | Auditar migrations Organizations/CRM/Inbox/WhatsApp | BLOQ |
| **60.03** | Ativação manual multi-org | BLOQ |

**Não executar `--apply`, DDL, migrations, grants, rotinas de provisioning ou restaurar backups** para melhorar o STATUS documental.

## Checkpoint e continuidade

| Momento | Ambiente/SHA | Evidência | Não auditado |
|---|---|---|---|
| 13/11/2026 | DevServer01; Git `1395597` | Consultas `BEGIN READ ONLY`, roles/bancos/schema/grants, migrador `--plan`: seis pendências | Dados pessoais, migrations, backup operacional |
| 13/11/2026 | CI GitHub da baseline `1395597` | [24/24 success](https://github.com/delmacy/syndes-system/actions/runs/43355545663) | Deploy real, staging, produção e Product Gate |

**Entregável:** registro da diferença **artefatos SQL versionados × objetos SQL realmente existentes**, isolamento básico observado e dependências de aplicação. O próximo owner a auditar é **C01 — Control Plane** para reconciliar especificamente os contratos e tabelas de Control sem DDL involuntário.

**Status final: auditoria documental/SQL parcial; banco de desenvolvimento observado; produto e operação não homologados.**
