# C01 — Control Plane | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline de código `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`; snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **Consultas SQL somente leitura, sem dados pessoais ou segredos. Nenhuma migration, grant, role, API, worker, container, backup ou deploy alterado.** Staging e produção não verificados.

## Matriz de estado por evidência

| Dimensão | Comprovação | Limite |
|---|---|---|
| **Documentação C01** | **AUDITORIA PARCIAL:** oito capítulos, reference, contracts, WBS, schema e APIs por owner reconciliados | Revisão formal e aceite dos responsáveis ainda pendentes |
| **Control base** | `tenant_registry` e `tenant_memberships` presentes, **1 tenant em `active`** | Esse estado não comprova módulos, memberships efetivas, FGA ou serviços operacionais |
| **Manager base** | `platform_operator_access`, `platform_tenant_profiles` presentes; `syndes_master_api` com leitura e sem DML de perfis | Endpoint Manager completo não testado em HTTP no ambiente |
| **Account roles** | SQL versionado; `tenant_account_role_grants`, `tenant_account_role_audit` ausentes no DevServer | A06 e delegação funcional não homologados |
| **Catálogo e releases** | `module_catalog`, `module_catalog_versions`, `module_catalog_dependencies` **ausentes** | Consulta Host/Manager depende de schema não instalado |
| **Entitlements/instalação** | `tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit` **ausentes** | Não declarar nenhuma instalação/ENABLED por inferência |
| **Operadores de módulos** | Roles `syndes_module_operator`, `syndes_module_installer`, `syndes_module_activator` **ausentes** | Sem grants/identidades operacionais para transition/attest |
| **Eventos Control** | `control_events.outbox_events/deliveries/consumer_inbox` **ausentes** | Evento v1 é contrato no código, não dispatcher ativo |
| **Migração Control** | `control_module_schema_migrations` ausente; `module_migrations.py --plan`: **6 PENDING** | `--apply` não executado; CP-G01 bloqueado |
| **Core Host/Kernel** | Ports/adapters disponíveis em `A08/A04`; `PgEffectiveModuleAccess` falha fechado em erro | `executeModule` opt-in; outras rotas não automaticamente cobertas |
| **Manager inventário** | `GET /v1/platform/admin/tenants/:id/modules` existe no código e consulta tabelas ausentes | **Pode retornar 503** por erro SQL; não testado em HTTP real nesta auditoria |
| **CI baseline** | [Run 43359636260](https://github.com/delmacy/syndes-system/actions/runs/43359636260): **24/24 jobs success** no SHA `ac8deb8` | Testes PG17 descartáveis, não rollback/restore do Control persistente |
| **Deploy, staging e produção** | Nenhuma implantação adicional comprovada nesta revisão | **NÃO VERIFICADO** |

## Divergências priorizadas

1. **P0 — Consumer/schema parity:** a API Manager de inventário e os adapters Host consultam tabelas de catálogo/lifecycle que ainda **não existem** no Control do DevServer01. A ausência de objeto SQL não deve ser tratada como lista vazia de módulos.
2. **P0 — tenant `active` não demonstra módulos habilitados:** um tenant está registrado como ativo, porém não existem os dados de módulo necessários para entitlement/installation/ENABLED. Risco de UX ou APIs inferirem acesso inadequadamente.
3. **P1 — seis migrations Control pendentes:** stages 001–006 com checksums versionados; ledger ausente e roles de módulos não criadas. **Não aplicar** sem backup, restore, release SHA, owner e Product Gate.
4. **P1 — Account roles/delegação ausentes:** tabelas/funções do contrato Account não confirmadas; dependências da A06/FGA reais precisam de gate próprio.
5. **P1 — Control events não instalado:** SQL/trigger disponíveis no Git, sem tables/dispatcher/consumer autorizados neste ambiente; tenant outbox é outro plano de dados.
6. **P1 — testes/disponibilidade reais:** CI aprovada em fixtures; falta provar a composição Host/Manager/Control do ambiente persistente, negativas de tenant e recovery.
7. **P1 — outros ambientes sem evidência:** conectores `server02` e `win1-server` offline durante a auditoria; não inferir produção inativa ou conforme.

## WBS preservada

| ID | Fonte | Estado histórico |
|---|---|---|
| **20.04** | Manager API role/AppRole | BLOQ infra |
| **30.03** | Account API/SQL delegação | BLOQ |
| **40.02** | Tenant Syndes convencional | BLOQ |
| **55.03** | Installer/entitlements/gates | API opt-in e teste PG17; Control/restore/FGA reais BLOQ |
| **90.02/90.03** | Métricas agregadas Support→Manager | BLOQ |
| **CP-E01..E07** | Artefatos/versionamento e testes Control Events | No Git; WBS registra entrega em worktree, **não aplicada operacionalmente** |
| **CP-G01** | Apply Control 001–006 | **BLOQ** — backup/restore/approval |
| **CP-G02** | Dispatcher/grants de serviço Control | **BLOQ** |
| **CP-G03** | Consumers/observabilidade e replay Control | **PEND** |

## Próximos passos autorizáveis, não executados

A sequência correta é revisar os consumers reais e a versão da instalação, obter evidência de backup/restore e aprovação para um plano de migração, realizar ensaios negativos em staging e só então decidir se/como aplicar os schemas. **Esta entrega não abre gate de migration nem modifica dados.**

### Checkpoint por ambiente

| Momento | Fonte | Evidência | Não comprovado |
|---|---|---|---|
| 13/11/2026 04:38Z | DevServer01, `syndes_control`, somente leitura | Registry, Manager base, um tenant ativo; catálogo/roles/eventos ausentes, 6 PENDING | Dados de clientes, Product Gate, backup/restore, staging |
| 13/11/2026 | CI no SHA `ac8deb8` | [24/24 success](https://github.com/delmacy/syndes-system/actions/runs/43359636260) | Release operacional e compatibilidade de API live |

**Status: auditoria técnica parcial de C01; esquema Control base presente, camada de módulos/eventos não instalada na instância examinada. Próxima unidade documental: C03 — Identity Keycloak.**
