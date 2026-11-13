---
title: "C01 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline de código `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`; snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **Consultas SQL somente leitura, sem dados pessoais ou segredos. Nenhuma migration, grant, role, API, worker, container, backup ou deploy alterado.** Staging e produção não verificados.

> L26: 2. **P0 — tenant `active` não demonstra módulos habilitados:** um tenant está registrado como ativo, porém não existem os dados de módulo necessários para entitlement/installation/ENABLED. Risco de UX ou APIs inferirem acesso inadequadamente.

> L29: 5. **P1 — Control events não instalado:** SQL/trigger disponíveis no Git, sem tables/dispatcher/consumer autorizados neste ambiente; tenant outbox é outro plano de dados.

> L49: A sequência correta é revisar os consumers reais e a versão da instalação, obter evidência de backup/restore e aprovação para um plano de migração, realizar ensaios negativos em staging e só então decidir se/como aplicar os schemas. **Esta entrega não abre gate de migration nem modifica dados.**

> L55: \| 13/11/2026 04:38Z \| DevServer01, `syndes_control`, somente leitura \| Registry, Manager base, um tenant ativo; catálogo/roles/eventos ausentes, 6 PENDING \| Dados de clientes, Product Gate, backup/restore, staging \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA E SQL SOMENTE LEITURA — 13/11/2026.** Base `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`. Snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **C01 é uma fronteira distribuída de dados/contratos globais, não um serviço isolado.** Não foram consultados dados pessoais nem executados migrations, grants, escrita, restore ou deploy. Produção e staging não verificados.

> L9: \| C01 \| `infra/postgres/bootstrap/control.schema`, `control-admin.schema`, `control-module-*.schema`, `control-account-*.schema` \| PostgreSQL 17 `syndes_control`: tenant registry/membership, metadados de Manager, catálogo/release/entitlement de módulo \|

> L10: \| I04 \| `infra/postgres/compose.yaml`, `00-init.sh`, `provision-tenant.sh` \| Servidor/DB/role, segurança de conexão e volumes; **não** decisão de autorização do produto \|

> L11: \| C02 \| `scripts/control/module_migrations.py`, `infra/postgres/bootstrap/migrate-modules-tenant.sh` \| Installer/operador de migrations; somente com release SHA, backup/restore, checksum e gates \|

> L13: \| A04 \| `apps/core-host/src/module-catalog.ts`, `module-lifecycle.ts`, `module-effective-access.ts`, `module-installer.ts` \| Adapters PostgreSQL, readmodels, gates opt-in e installer trusted \|

> L14: \| A05 \| `apps/master-admin-api/src/server.mjs`, `modules/tenant-module-inventory.mjs` \| HTTP read-only de metadados, com JWT/allowlist e role própria; sem tenant DB \|

> L16: \| C06 \| `infra/postgres/bootstrap/control-module-events.schema`, `apps/core-host/src/platform-event-*.ts` \| Eventos de administração em Control separados dos eventos de domínio em tenant \|

> L18: **C01 não tem `package.json`, classes HTTP, frontend ou APIs próprios em `infra/postgres/bootstrap`.** As classes e métodos abaixo pertencem aos owners citados e foram confrontados com arquivos reais, não atribuídos ficticiamente à C01.

> L58: O `control-plane-events.ts` do Kernel define **dois envelopes v1**: `platform.module.entitlement.changed.v1` e `platform.module.installation.changed.v1`. O `control-module-events.schema` escreve outbox através do trigger `control_events.enqueue_module_audit()` após INSERT no log append-only `tenant_module_audit`, mantendo o mesmo commit PostgreSQL. `event_deliveries` e `consumer_inbox` dão suporte a tentativas, lease

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/OPERACAO.md)

> L3: > **RUNBOOK DE CONSULTA, NÃO DE IMPLANTAÇÃO.** A auditoria C01 de 13/11/2026 examinou somente catálogo de PostgreSQL e código versionado. Não autoriza DDL, migrations, grants, workers ou leitura de dados pessoais.

> L15: - [Código/artefato do módulo](https://github.com/delmacy/syndes-system/tree/main/infra/postgres/bootstrap) — `infra/postgres/bootstrap`.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L31: \| Classe de dados \| Presente \| Ausente / pendente \|

> L78: `control_events` foi projetado com outbox, delivery e inbox no **banco Control**, recebendo dados de `tenant_module_audit` na mesma transação. Esse schema contém fatos administrativos de entitlement/instalação, não mensagens. Por outro lado, `platform_events` é schema do **tenant DB**, para eventos dos módulos. A disponibilidade de contrato v1 ou teste PG17 sintético não autoriza dispatcher/control worker ou envio de

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
