---
title: "P05 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P05-gestao-de-atendimentos/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P05-gestao-de-atendimentos/REFERENCIA-TECNICA.md)

> L43: Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.

> L45: \| Arquivo SQL encontrado \| Banco/owner e estado \|

> L47: \| [001_service_funnels.sql](https://github.com/delmacy/syndes-system/blob/main/modules/service-management/sql/001_service_funnels.sql) \| A confirmar com o manifesto de migração \|

> L48: \| [002_service_team_transfer.sql](https://github.com/delmacy/syndes-system/blob/main/modules/service-management/sql/002_service_team_transfer.sql) \| A confirmar com o manifesto de migração \|

> L49: \| [003_service_conversation_inspector.sql](https://github.com/delmacy/syndes-system/blob/main/modules/service-management/sql/003_service_conversation_inspector.sql) \| A confirmar com o manifesto de migração \|

> L53: Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

> L58: - **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P05-gestao-de-atendimentos/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P05-gestao-de-atendimentos/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P05-gestao-de-atendimentos/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L2: - Componentes, ownership de dados, migrations e autorização: A VERIFICAR.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P05-gestao-de-atendimentos/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
