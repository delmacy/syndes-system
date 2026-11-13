---
title: "Q07 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)

> L45: \| 2026-11-12 \| `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f`, [run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873) \| **24/24 jobs success**, incluído `Syndes CI Gate`; Pages publicado em run 43339625845 \| Homologação operacional, backup/restore real e Product Gate continuam separados \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/REFERENCIA-TECNICA.md)

> L32: **Q07 não publica API HTTP, eventos do domínio nem banco operacional.** Seu contrato público para GitHub Actions é a matriz JSON `{"include":[{"suite":"...", "node":"..."}]}`, os exit codes, logs de jobs e o `Syndes CI Gate`. Não modificar contratos públicos de P01/P02/P03/P05 para corrigir seleção.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Q07 não mantém API HTTP, schema PostgreSQL, controller, port NestJS nem eventos de negócio**. Seus contratos executáveis são **comandos, JSON de planejamento, YAML de CI e exit codes**, consumidos pelo GitHub Actions.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
