---
title: "I04 · Fontes e endereços"
description: "Volume Infraestrutura e qualidade · capítulo I04 · matéria 00"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/00-enderecos-exatos-de-leitura.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 0. Fontes de verdade, evidências e período observado

> **Auditoria técnica documental + catálogo PostgreSQL em modo somente leitura — 13/11/2026.** Checkout base `origin/main` SHA `13955974bc0702f4c7fcb5717ee2d7cb243f5f08`; DevServer01 online. Os hosts adicionais e produção não foram auditados. Nenhum registro de cliente foi consultado ou exportado.

| Fonte | Escopo e interpretação |
|---|---|
| `catalog/work-units.json` (`I04`) | `infra/postgres`, `maturity=verified`; **maturidade de inventário não é produção homologada** |
| [`infra/postgres/compose.yaml`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/compose.yaml) | PostgreSQL 17, secrets de arquivo, dados em volume e duas redes; configuração declarada |
| [`infra/postgres/bootstrap/00-init.sh`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/bootstrap/00-init.sh) | Criação inicial de roles e databases; só roda pelo entrypoint em **volume novo** |
| [`infra/postgres/bootstrap/control.schema`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/bootstrap/control.schema) | Registry e memberships Control |
| [`infra/postgres/bootstrap/provision-tenant.sh`](https://github.com/delmacy/syndes-system/blob/main/infra/postgres/bootstrap/provision-tenant.sh) | Criação de DB/role por UUID, sem ativar tenant |
| [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) | Plano/aplicação de **seis migrations Control** em ordem, checksums, SHA e gates; foi executado **apenas `--plan`** |
| `infra/postgres/bootstrap/control-module-*.schema`, `control-admin.schema`, `control-account-*.schema` | Candidatas de schemas e funções Control; **presença do SQL não comprova aplicação** |
| `infra/postgres/bootstrap/tenant-module-ledger.schema` | Ledger protegido `_syndes.module_migrations`, destinado ao **tenant DB** |
| `modules/*/sql`, `apps/core-host/sql` | Migrations dos owners de CRM, Inbox, WhatsApp, Organizations, Support, Service e Event Platform |
| `infra/postgres/bootstrap/migrate-modules-tenant.sh`, `support-migration-gate.sh` | Execução de migrations com imagem por digest e tenant aprovado; **não executados** |
| `tests/platform/postgres-smoke.sh`, `apps/core-host/test/*pg17*`, suites dos módulos | Testes de bancos **descartáveis** separados de DevServer/produção |
| [CI baseline](https://github.com/delmacy/syndes-system/actions/runs/43355545663) | 24/24 jobs `success` no SHA `1395597`; não comprova migrations operacionais |
| [WBS da unidade](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/EVOLUCAO.md) | 10.02, 10.07, 40.02, 40.08, 55.03, 60.02, 60.03 — estados históricos preservados |

### Método efetivamente utilizado

1. Leitura dos Compose, scripts SQL/shell, migrador Control, testes e WBS.
2. `docker ps` e saúde do container PostgreSQL principal.
3. Consultas **`BEGIN READ ONLY`** somente a `pg_database`, `pg_roles`, `pg_namespace`, `pg_class`/`to_regclass` e grants, com saída agregada e sem nomes de tenants.
4. `python3 scripts/control/module_migrations.py --plan` (consulta catálogo e ledger; **sem `--apply`**).
5. `bash -n` e `py_compile` de scripts, sem executá-los.

**Redação pública:** somente contagens, flags e nomes de objetos presentes no código. Não expor UUIDs reais, registros, credenciais, DSN, host/porta, nomes de bancos extras nem `docker inspect` integral.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/I04-postgresql/chapters/00-enderecos-exatos-de-leitura.md).
