---
title: "I04 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L15: \| **Eventos Control** \| `control_events` outbox/deliveries/inbox **ausentes** \| Nenhum worker pode ser considerado habilitado por documentação \|

> L24: 1. **P0 — Plano de migrations Control: seis etapas pendentes.** `scripts/control/module_migrations.py --plan` informou `001_catalog`, `002_lifecycle`, `003_attestation`, `004_activation`, `005_manager_readonly`, `006_control_events` como PENDING. Há objetos Manager base presentes, mas nenhuma dessas seis migrações aparece aplicada. **Não presumir que o Host esteja apto a operar o catálogo/eventos.**

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L7: **PostgreSQL 17**, Docker Compose, bancos separados por função e por tenant, roles isoladas, secrets por arquivo e SQL versionado. I04 é infraestrutura, **não possui package.json, frontend, APIs HTTP, classes NestJS ou eventos de negócio próprios**. Os dados de domínio e providers SQL pertencem a seus módulos.

> L11: \| Instância PostgreSQL \| [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) \| `postgres:17-bookworm`, volume `postgres_data`, healthcheck `pg_isready`, sem porta DB publicada no Compose \|

> L36: \| Outbox Control \| `control_events.outbox_events`, `event_deliveries`, `consumer_inbox`: **ausentes** \|

> L74: - A outbox de tenant usa `platform_events` e depende do instalador/worker sob gates próprios.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/04-contratos-e-dependencias-publicas.md)

> L3: I04 expõe **contratos de PostgreSQL/SQL e scripts operacionais**, não endpoints REST, eventos SaaS ou `package exports`.

> L7: \| `infra/postgres/compose.yaml` \| Serviço `postgres:17-bookworm`; Docker Secrets `POSTGRES_PASSWORD_FILE`; volume `postgres_data`; redes `syndes-data` e `syndes-master-data`; `pg_isready` \| Sem porta DB publicada pelo Compose; saúde Docker `healthy` observada \|

> L24: - **Eventos:** outbox Control em `control_events` e outbox de tenant em `platform_events` são domínios distintos, com tabelas, regras e owners distintos.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L35: \| Control \| `control_events.outbox_events/deliveries/consumer_inbox` \| Eventos Control — C01/C06 \| **Ausentes** \|

> L38: \| Tenant \| `platform_events` \| Event Bus/Transactional Outbox de tenant \| **Schema não encontrado** \|

> L76: - `infra/postgres/compose.yaml`: banco sem portas publicadas, redes `syndes-data` e `syndes-master-data` (controle Manager), secrets de arquivos Docker, `no-new-privileges` e `POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256`.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
