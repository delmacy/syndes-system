---
title: "I04 · Configuração e ambiente"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Configuração e ambiente

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)

> L9: \| **Documentação I04** \| **AUDITORIA PARCIAL:** SQL/Compose, contratos, 8 capítulos, bancos/roles/grants, diagrama e WBS reconciliados \| Ratificação pelos owners/DBA pendente \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/REFERENCIA-TECNICA.md)

> L7: **PostgreSQL 17**, Docker Compose, bancos separados por função e por tenant, roles isoladas, secrets por arquivo e SQL versionado. I04 é infraestrutura, **não possui package.json, frontend, APIs HTTP, classes NestJS ou eventos de negócio próprios**. Os dados de domínio e providers SQL pertencem a seus módulos.

> L11: \| Instância PostgreSQL \| [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) \| `postgres:17-bookworm`, volume `postgres_data`, healthcheck `pg_isready`, sem porta DB publicada no Compose \|

> L12: \| Segurança e redes \| Compose e [`infra/README.md`](https://github.com/delmacy/syndes-system/blob/main/infra/README.md) \| `syndes-data`, `syndes-master-data`, SCRAM para host, secret files; saúde e firewall dependem da operação \|

> L83: - **Validação não destrutiva local:** leitura de SQL/Compose, `bash -n` de scripts, `py_compile` e plano Control `--plan`. Não executar `--apply`, `migrate-modules-tenant.sh`, `provision-tenant.sh` ou `postgres-smoke.sh` em host persistente.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L76: - `infra/postgres/compose.yaml`: banco sem portas publicadas, redes `syndes-data` e `syndes-master-data` (controle Manager), secrets de arquivos Docker, `no-new-privileges` e `POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256`.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
