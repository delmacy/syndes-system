---
title: "I04 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L9: \| **Documentação I04** \| **AUDITORIA PARCIAL:** SQL/Compose, contratos, 8 capítulos, bancos/roles/grants, diagrama e WBS reconciliados \| Ratificação pelos owners/DBA pendente \|

> L13: \| **Control mínimo** \| `tenant_registry`, `tenant_memberships` presentes, SELECT do core; Manager com perfil/operador e SELECT, sem DML de perfis \| Tabelas adicionais do Control não necessariamente instaladas \|

> L16: \| **Control migration ledger** \| `public.control_module_schema_migrations` **ausente**; migrador oficial **6 PENDING** via `--plan` \| Não executar `--apply` sem backup/restore, SHA e owner \|

> L17: \| **Tenant DB observado** \| Sem schemas de CRM, Inbox, WhatsApp, Organizations, Support, Service, `platform_events` ou ledger `_syndes` \| Pode ser tenant apenas `provisioned`; ausência não é falha funcional demonstrada \|

> L24: 1. **P0 — Plano de migrations Control: seis etapas pendentes.** `scripts/control/module_migrations.py --plan` informou `001_catalog`, `002_lifecycle`, `003_attestation`, `004_activation`, `005_manager_readonly`, `006_control_events` como PENDING. Há objetos Manager base presentes, mas nenhuma dessas seis migrações aparece aplicada. **Não presumir que o Host esteja apto a operar o catálogo/eventos.**

> L25: 2. **P1 — Tenant existente sem schema de negócio/ledger.** Um DB de tenant canônico está provisionado, porém faltam `crm/inbox/whatsapp/organizations/support/service/platform_events/_syndes`. Verificar finalidade e estado antes de instalar; o gateway ou Host em execução não comprova a presença desse schema.

> L27: 4. **P1 — Teste de isolamento incompleto.** `CONNECT` e grants básicos estão restritivos no banco examinado, mas falta matriz SQL completa e teste API/authorization A/B contra providers reais.

> L38: \| **40.08** \| Migrations tenant Syndes + backup/restore \| BLOQ \|

> L39: \| **55.03** \| Installer, canonicidade e schema/gates \| API opt-in/PG17 sintético; Control/restore/FGA reais BLOQ \|

> L40: \| **60.02** \| Auditar migrations Organizations/CRM/Inbox/WhatsApp \| BLOQ \|

> L43: **Não executar `--apply`, DDL, migrations, grants, rotinas de provisioning ou restaurar backups** para melhorar o STATUS documental.

> L49: \| 13/11/2026 \| DevServer01; Git `1395597` \| Consultas `BEGIN READ ONLY`, roles/bancos/schema/grants, migrador `--plan`: seis pendências \| Dados pessoais, migrations, backup operacional \|

> L52: **Entregável:** registro da diferença **artefatos SQL versionados × objetos SQL realmente existentes**, isolamento básico observado e dependências de aplicação. O próximo owner a auditar é **C01 — Control Plane** para reconciliar especificamente os contratos e tabelas de Control sem DDL involuntário.

> L54: **Status final: auditoria documental/SQL parcial; banco de desenvolvimento observado; produto e operação não homologados.**

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline `origin/main` SHA `13955974bc0702f4c7fcb5717ee2d7cb243f5f08`, inspeção somente leitura do PostgreSQL **DevServer01**. Não foi consultado conteúdo pessoal de clientes nem executado DDL/DML, migration, backup, restore ou modificação de container. **Staging e produção não verificados.**

> L7: **PostgreSQL 17**, Docker Compose, bancos separados por função e por tenant, roles isoladas, secrets por arquivo e SQL versionado. I04 é infraestrutura, **não possui package.json, frontend, APIs HTTP, classes NestJS ou eventos de negócio próprios**. Os dados de domínio e providers SQL pertencem a seus módulos.

> L13: \| Bootstrap de DBs \| `infra/postgres/bootstrap/00-init.sh`, `control.schema` \| Três databases técnicos separados, registry/membership; init em volume novo \|

> L15: \| Migrations Control \| [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) \| Plano/aplicação com SHA/checksum, PG17, ledger e autorização; **`--plan` executado, seis PENDING** \|

> L16: \| Migrations Tenant \| `infra/postgres/bootstrap/migrate-modules-tenant.sh`, `tenant-module-ledger.schema` \| Imagem por `@sha256`, mapping verificado e ledger de execução privado; **não executado** \|

> L17: \| Persistência de módulos \| `modules/{core-crm,inbox,whatsapp,organizations,support,service-management}/sql` \| Contratos SQL de cada owner, não instalações comprovadas no tenant examinado \|

> L18: \| Event Bus \| `apps/core-host/sql/001_platform_events.sql`, `002_event_type_version_consistency.sql`, Control `control-module-events.schema` \| Schemas/objetos planejados por banco distintos; workers opt-in sob gates \|

> L35: \| Ledger das migrations Control \| `public.control_module_schema_migrations`: **ausente** \|

> L37: \| Ledger/módulos do tenant \| Schema `_syndes` e schemas `crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service`, `platform_events`: **não encontrados** no DB tenant canônico \|

> L40: **Limite:** esse resultado descreve apenas os bancos e objetos catalogados nessa instância e naquele instante. Um container `healthy` não prova saúde funcional do CRM/Inbox, e a ausência de schema em um DB canônico não demonstra que nenhum outro ambiente ou host contenha o módulo.

> L48: \| `scripts/control/module_migrations.py:release_files()` \| C01/C02 \| Lista fixa 001–006 com SHA-256 dos SQL versionados \|

> L49: \| `inventory(container)` / `reconcile(container,migrations)` \| C01/C02 \| Consulta catálogo/ledger, recusa checksum drift, objetos sem histórico, ordem inválida \|

> L50: \| `main() --plan` \| C01/C02 \| **Somente leitura** da situação de migrations; na coleta: todas pendentes \|

> L52: \| `migrate-modules-tenant.sh` \| C02/A04 \| Imagem pinned `@sha256`, consulta mapping Control e executa SQL por role de tenant \|

> L53: \| `support-migration-gate.sh` \| P06/C02 \| Garante tenant operacional aprovado para migrations Support \|

> L54: \| `tenant-module-ledger.schema` \| C02 \| `_syndes.module_migrations` com PK de módulo/migration, checksum e digest \|

> L57: Não confundir funções do **migrador de operador** com endpoints públicos. Scripts de provisioning e manutenção são interfaces privadas. O site público não publica valores de secrets, DSNs, nomes reais de tenants, dados de usuários nem comandos de aplicação de migration.

> L72: - SQL de `crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service` pertence aos módulos, sem presumir execução.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

> L3: > **RUNBOOK DE CONSULTA E AUDITORIA, NÃO PROCEDIMENTO DE IMPLANTAÇÃO.** A inspeção de 13/11/2026 foi somente leitura de catálogos de desenvolvimento. Não executar migrations, provisioning, alterações de privilégios, backup ou restore a partir desta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L39: O script versionado de consulta de migrations Control aceita o modo **não mutante**:

> L45: No checkpoint, esse comando mostrou **seis migrations PENDING** e `PLAN ONLY: no Control DB changes`. **Não usar `--apply`** sem aprovação do owner e evidência explícita de backup/restore; o modo de aplicação tem gates próprios de SHA, ledger, lock e revisão.

> L53: Esses metadados não provam schemas migrados. A versão PostgreSQL, os bancos e os grants foram conferidos na instância de desenvolvimento, **não em staging/produção**. Consultas adicionais devem passar por DBA/segurança e **jamais** publicar `docker inspect` completo, `pg_dump` ou linhas com PII.

> L61: 5. Registrar resultado por SHA/ambiente, com negativas de acesso, migrações aplicadas e schema compatível. CI de DB descartável **não** representa execução no DevServer.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/04-contratos-e-dependencias-publicas.md)

> L3: I04 expõe **contratos de PostgreSQL/SQL e scripts operacionais**, não endpoints REST, eventos SaaS ou `package exports`.

> L9: \| `bootstrap/control.schema` \| `public.tenant_registry`, `public.tenant_memberships`; restrição `PUBLIC`, `syndes_core` com `SELECT` \| Objetos e grants básicos encontrados no DevServer01 \|

> L11: \| `bootstrap/control-admin.schema` \| `syndes_master_api`, `platform_operator_access`, `platform_tenant_profiles`, SELECT global limitado \| Role e tabelas presentes; demais fluxos Manager têm gates próprios \|

> L12: \| `scripts/control/module_migrations.py --plan` \| Verifica versão PG17/target/ledger, checksums fixos dos seis SQL e estado sem DDL \| Executado; **seis PENDING**, sem apply \|

> L13: \| `scripts/control/module_migrations.py --apply` \| SQL Control transacional, lock/advisory, pin SHA, backups e restore-ID \| **Não executado.** Exige autorização operacional explícita; não usar para corrigir a documentação \|

> L14: \| `bootstrap/tenant-module-ledger.schema` \| `_syndes.module_migrations` com `module_id`, `migration_id`, `version`, `checksum`, `image_digest` \| Não encontrado no DB tenant auditado; runtime role não deve poder alterar ledger \|

> L15: \| `bootstrap/migrate-modules-tenant.sh` \| Confere mapping em Control; imagem `@sha256` e migrations do Host; `SET ROLE` no DB do tenant \| **Não executado**; depende de release, backup/restore e gates \|

> L16: \| `bootstrap/support-migration-gate.sh` \| Support migration somente se `TENANT_ID` corresponder ao tenant operacional permitido \| Evita provisionar Support em tenant comercial; não é autorização de API \|

> L18: \| `apps/core-host/test/*pg17*.test.mjs` \| Instalador, Control/events, FGA, tenant A/B, migration ledger e módulos \| Evidências por suite/CI, não autorização para aplicar schemas no DevServer \|

> L22: - **Contratos públicos de módulos:** APIs/ports/versionamento de CRM, Inbox, WhatsApp, Organizations, Support e Service pertencem aos owners; SQL infra de I04 não é biblioteca reutilizável pelo frontend.

> L24: - **Eventos:** outbox Control em `control_events` e outbox de tenant em `platform_events` são domínios distintos, com tabelas, regras e owners distintos.

> L26: - **Mudanças de SQL:** requerem ownership C01/C02/C06 ou módulo, revisão de impacto, SHA/digest, backup/restore e rollback; mera presença de arquivo `.schema` não autoriza aplicação.

> L30: Control base (registry/membership) e Manager base estão **instalados**; catálogo/entitlements/events de módulos estão **ausentes** na instância examinada. O migrador Control de fato informa as seis etapas como **PENDING**. No DB tenant observado, os schemas de módulo e o ledger `_syndes` não apareceram. Isso é **diferença de estado**, não falha comprovada dos contratos versionados.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L30: \| Database \| Schema/tabela \| Natureza \| Estado no DevServer01 \|

> L37: \| Tenant \| `crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service` \| Domínios dos módulos \| **Schemas não encontrados** \|

> L38: \| Tenant \| `platform_events` \| Event Bus/Transactional Outbox de tenant \| **Schema não encontrado** \|

> L39: \| Keycloak/FGA \| Bancos técnicos separados \| Identidade e autorização \| DBs presentes; tabelas internas não auditadas \|

> L78: - Scripts `00-init.sh` são disparados pelo `docker-entrypoint-initdb.d` apenas na criação de volume; aplicar `control.schema` em ambiente já persistente exige migrador/gate.

> L80: - Para Support, somente tenant operacional autorizado recebe migration; a ativação multi-org permanece **manual e com Product Gate**.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
