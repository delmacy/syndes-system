---
title: "C01 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline de código `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`; snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **Consultas SQL somente leitura, sem dados pessoais ou segredos. Nenhuma migration, grant, role, API, worker, container, backup ou deploy alterado.** Staging e produção não verificados.

> L20: \| **CI baseline** \| [Run 43359636260](https://github.com/delmacy/syndes-system/actions/runs/43359636260): **24/24 jobs success** no SHA `ac8deb8` \| Testes PG17 descartáveis, não rollback/restore do Control persistente \|

> L21: \| **Deploy, staging e produção** \| Nenhuma implantação adicional comprovada nesta revisão \| **NÃO VERIFICADO** \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA E SQL SOMENTE LEITURA — 13/11/2026.** Base `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`. Snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **C01 é uma fronteira distribuída de dados/contratos globais, não um serviço isolado.** Não foram consultados dados pessoais nem executados migrations, grants, escrita, restore ou deploy. Produção e staging não verificados.

> L51: \| A04 Host \| `PgModuleInstaller`, `PgControlInstallAttestor`, `PgControlModuleActivator` \| Contratos de operação trusted, não endpoints de provisionamento público \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/OPERACAO.md)

> L3: > **RUNBOOK DE CONSULTA, NÃO DE IMPLANTAÇÃO.** A auditoria C01 de 13/11/2026 examinou somente catálogo de PostgreSQL e código versionado. Não autoriza DDL, migrations, grants, workers ou leitura de dados pessoais.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

> L45: Antes de qualquer alteração, exigir: comparação de runtime/consumer com schema realmente implantado; owners C01/I04/C02/A04/A05/C06; backup real e restore isolado ensaiado; checksum/SHA da release; janela e reversão; grants e testes negativos A/B; gate explícito. Não usar essa documentação como autorização operacional.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L27: **Fluxos no diagrama descrevem dependências arquiteturais, não conexões implantadas/aprovadas em staging.** C01 não é mais um container de aplicação e não oferece um frontend próprio.

> L85: - **Backup e recuperação:** ausência de migração e ledger no runtime **não é justificativa para aplicar SQL** sem restore real da versão implantada. Staging e produção permanecem não verificados.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/06-wbs-marcos-e-aceite.md)

> L30: 2. Examinar backup/recovery **real**, versão PG17, plano de rollback, restore em local segregado e checksum/ledger sem dados pessoais publicados.

> L32: 4. Somente então executar migrations 001–006 via operação separada, com teste de grants, tenant A/B, idempotência e transação. **Não realizado nesta auditoria.**

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
