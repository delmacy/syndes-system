---
title: "I04 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline Git `13955974bc0702f4c7fcb5717ee2d7cb243f5f08` (`origin/main`); DevServer01 acessado por conector autorizado. **Foram realizadas somente consultas aos catálogos PostgreSQL, conferência de grants e `--plan` do migrador Control, sem DDL, DML, mudança operacional, dump, restore nem leitura de dados pessoais.** Outros hosts, staging e produção **não verificados**.

> L10: \| **Instância DevServer01** \| PostgreSQL **17**, container principal `healthy`; três DBs técnicos previstos presentes \| `healthy` não valida restauração, produto, TPS nem todos os providers \|

> L17: \| **Tenant DB observado** \| Sem schemas de CRM, Inbox, WhatsApp, Organizations, Support, Service, `platform_events` ou ledger `_syndes` \| Pode ser tenant apenas `provisioned`; ausência não é falha funcional demonstrada \|

> L35: \| **10.02** \| Revisar roles PostgreSQL e grants \| PEND \|

> L49: \| 13/11/2026 \| DevServer01; Git `1395597` \| Consultas `BEGIN READ ONLY`, roles/bancos/schema/grants, migrador `--plan`: seis pendências \| Dados pessoais, migrations, backup operacional \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline `origin/main` SHA `13955974bc0702f4c7fcb5717ee2d7cb243f5f08`, inspeção somente leitura do PostgreSQL **DevServer01**. Não foi consultado conteúdo pessoal de clientes nem executado DDL/DML, migration, backup, restore ou modificação de container. **Staging e produção não verificados.**

> L7: **PostgreSQL 17**, Docker Compose, bancos separados por função e por tenant, roles isoladas, secrets por arquivo e SQL versionado. I04 é infraestrutura, **não possui package.json, frontend, APIs HTTP, classes NestJS ou eventos de negócio próprios**. Os dados de domínio e providers SQL pertencem a seus módulos.

> L11: \| Instância PostgreSQL \| [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) \| `postgres:17-bookworm`, volume `postgres_data`, healthcheck `pg_isready`, sem porta DB publicada no Compose \|

> L13: \| Bootstrap de DBs \| `infra/postgres/bootstrap/00-init.sh`, `control.schema` \| Três databases técnicos separados, registry/membership; init em volume novo \|

> L14: \| Provisionamento \| `infra/postgres/bootstrap/provision-tenant.sh` \| UUID canônico → role/DB individual, `REVOKE CONNECT PUBLIC`, `tenant_registry.state=provisioned` \|

> L16: \| Migrations Tenant \| `infra/postgres/bootstrap/migrate-modules-tenant.sh`, `tenant-module-ledger.schema` \| Imagem por `@sha256`, mapping verificado e ledger de execução privado; **não executado** \|

> L17: \| Persistência de módulos \| `modules/{core-crm,inbox,whatsapp,organizations,support,service-management}/sql` \| Contratos SQL de cada owner, não instalações comprovadas no tenant examinado \|

> L22: Consultas em transações `BEGIN READ ONLY` às **views de catálogo do próprio PostgreSQL** e grants; nomes/UUID de tenants e dados de negócio não foram emitidos.

> L26: \| Servidor \| PostgreSQL **17**, container principal `healthy` no momento da observação \|

> L55: \| `tests/platform/postgres-smoke.sh` \| Q01/I04 \| CI descartável: roles/isolamento, tenant idempotente e `pg_dump`/restore **sintético** \|

> L57: Não confundir funções do **migrador de operador** com endpoints públicos. Scripts de provisioning e manutenção são interfaces privadas. O site público não publica valores de secrets, DSNs, nomes reais de tenants, dados de usuários nem comandos de aplicação de migration.

> L67: - Control Plane não deve armazenar mensagens, conversas, anexos ou dados de CRM do tenant.

> L78: `syndes_keycloak` e `syndes_openfga` são databases separados. OpenBao **não usa PostgreSQL**: mantém Raft próprio. Komodo usa MongoDB na stack de administração; nenhum deles vira tenant DB por associação.

> L83: - **Validação não destrutiva local:** leitura de SQL/Compose, `bash -n` de scripts, `py_compile` e plano Control `--plan`. Não executar `--apply`, `migrate-modules-tenant.sh`, `provision-tenant.sh` ou `postgres-smoke.sh` em host persistente.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

> L15: - [Código/artefato do módulo](https://github.com/delmacy/syndes-system/tree/main/infra/postgres) — `infra/postgres`.

> L53: Esses metadados não provam schemas migrados. A versão PostgreSQL, os bancos e os grants foram conferidos na instância de desenvolvimento, **não em staging/produção**. Consultas adicionais devem passar por DBA/segurança e **jamais** publicar `docker inspect` completo, `pg_dump` ou linhas com PII.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/04-contratos-e-dependencias-publicas.md)

> L3: I04 expõe **contratos de PostgreSQL/SQL e scripts operacionais**, não endpoints REST, eventos SaaS ou `package exports`.

> L7: \| `infra/postgres/compose.yaml` \| Serviço `postgres:17-bookworm`; Docker Secrets `POSTGRES_PASSWORD_FILE`; volume `postgres_data`; redes `syndes-data` e `syndes-master-data`; `pg_isready` \| Sem porta DB publicada pelo Compose; saúde Docker `healthy` observada \|

> L17: \| `tests/platform/postgres-smoke.sh` \| Teste de três bancos, negativa de Keycloak→Control, provisionamento duplicado e restore de fixture \| Ambiente **descartável de CI**, não evidência de restore real \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L76: - `infra/postgres/compose.yaml`: banco sem portas publicadas, redes `syndes-data` e `syndes-master-data` (controle Manager), secrets de arquivos Docker, `no-new-privileges` e `POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256`.

> L77: - `postgres_data` é volume persistente. **A existência de volume e healthcheck não comprova backup**, retenção, recuperação ou recuperação entre múltiplos tenants no mesmo servidor.

> L79: - Um servidor PostgreSQL é ponto compartilhado de falha: separar DB por tenant dá isolamento lógico/permissões, **não alta disponibilidade, resiliência física ou backups independentes automáticos**.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
