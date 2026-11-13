---
title: "G03 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)

> L10: \| **Runtime G03** \| **Não aplicável** \| Owner é `AGENTS.md`; não possui package, endpoint, schema, worker ou front de produto \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA DOCUMENTAL ESTÁTICA PARCIAL — 12/11/2026.** Fonte examinada no commit `068954a21e3090c7f94d374e2a8486cec7c2537b`. G03 é governança de engenharia, com owner `AGENTS.md`; **não** possui runtime NestJS, endpoint, schema ou API própria.

> L29: **G03 não expõe APIs HTTP, schema GraphQL nem eventos do Event Bus do Syndes.** GitHub REST/Projects são integrações externas do sincronizador, não interfaces públicas do produto.

> L42: **Nenhuma tabela ou migration pertence à G03.** Git é a origem de código/histórico; Issues/Projects armazenam estados externos sob controle do GitHub; WBS e documentação guardam vínculos e decisões. O `Control DB` e os bancos de tenant não são utilizados para planejar workpackages do portal.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **G03 não publica APIs HTTP, classes NestJS, eventos de negócio nem esquema SQL.** Seus contratos são políticas e formatos de governança.

> L27: - **DDL e dados** pertencem ao módulo dono do schema e ao instalador/operador; G03 não executa migrations.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
