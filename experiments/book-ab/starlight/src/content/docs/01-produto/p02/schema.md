---
title: "P02 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/STATUS.md)

> L26: - SQL 002 continua ativo; transferências e paths tenant-only legados exigem novo gate.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/REFERENCIA-TECNICA.md)

> L44: Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.

> L46: \| Arquivo SQL encontrado \| Banco/owner e estado \|

> L48: \| [001_inbox_foundation.sql](https://github.com/delmacy/syndes-system/blob/main/modules/inbox/sql/001_inbox_foundation.sql) \| A confirmar com o manifesto de migração \|

> L52: Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

> L57: - **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L9: - Persistência do módulo: `modules/inbox/sql/001_inbox_foundation.sql`; não adotar tabelas de CRM como propriedade da Inbox.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
