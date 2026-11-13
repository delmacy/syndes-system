---
title: "A08 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/REFERENCIA-TECNICA.md)

> L8: - **Tecnologia:** TypeScript 5.9 / Node 22+, compilado por `tsc`, sem dependências diretas de NestJS, SQL ou OpenFGA (`packages/core-kernel/package.json`).

> L19: \| `ModuleRegistry` — `src/module-registry.ts` \| `register(module)` \| Valida ID, versão, schema, dependências e duplicações \|

> L38: - **Tenant DB:** nenhuma tabela/migration de ownership do Kernel.

> L39: - **Control/Manager DB:** nenhuma tabela de ownership do Kernel.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L2: - Componentes, ownership de dados, migrations e autorização: A VERIFICAR.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A08-core-kernel/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
