---
title: "Q10 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 12/11/2026.** Checkout `origin/main` SHA `69670e27e5c8e22240642f5cde67986ac0e8376b` (DevServer01, worktree isolada). Foram examinados os testes de integridade, a estratégia de qualidade, o pipeline e critérios de release. Não foram realizados nesta auditoria testes de produto, identidade real, migrations ou deploy; **Quality Gate global não aprovado**.

> L32: 4. **Segurança/tenancy:** não foram testadas nesta auditoria negações cross-tenant, Keycloak/OpenFGA real, SQL com tenant A/B, multi-org nem identidade service.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/REFERENCIA-TECNICA.md)

> L26: **Q10 não oferece controller HTTP, `package.json#exports`, evento de negócio, port de runtime nem assinatura de schema.** O contrato da Q10 é de **qualidade**: checagem de integridade com exit code, evidência vinculada ao commit e rastreabilidade dos gates.

> L39: **Q10 não possui tabelas PostgreSQL, schema próprio, migrations nem dependência de banco operacional.** Os testes de migrations e restore estão sob ownership de módulos, infraestrutura e equipes de qualidade; prova descartável de PostgreSQL não equivale a migration aplicada/backup restaurado em produção.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Entrada:** checkout com SHA/branch, catálogo, `AGENTS.md` e arquivos mínimos; **saída:** teste de integridade com exit code e logs, consumido pelo job `foundation`. Q10 **não** publica API HTTP, evento, contrato TypeScript, migration ou serviço de banco de dados. O teste retorna falha se faltarem arquivos ou contratos locais de agente.

> L11: \| Q02/Q03 — testes por módulo e integração \| Unidades, contratos, integridade de estado e migrations \| Mock/PG descartável ≠ sistema operacional \|

> L33: Se uma API, evento, port, migration ou política mudar, o owner identifica os consumers e pede suites de regressão pertinentes; novos módulos também precisam ser considerados pelo planner. Alterações em `scripts/ci`, `.github/workflows`, infraestrutura e API pertencem a Q07/owners, **não** à presente revisão da Q10.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L30: \| **Integração/contrato** \| Q03 + módulos; API/PG/migrations/events/idempotência \| Só integração no ambiente do ensaio \|

> L48: - Q10 **não mantém banco PostgreSQL, migrations, tabelas ou API REST**. Fonte: scripts, resultados de CI, WBS e documentos versionados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
