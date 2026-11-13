---
title: "P03 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)

> L7: Pacote TypeScript com contas, outbox, inbound, dispatch, contratos e migrations 001–008; gateway Go/Whatsmeow existe. O plugin consta em apps/core-host/config/modules.json, mas a inscrição não prova módulo habilitado por tenant nem projetor novo operacional.

> L16: \| `modules/whatsapp/sql/008_whatsapp_projection_owner.sql` \| Artefato presente no checkout; não implica runtime habilitado \|

> L24: - WA-CUT07–10: migration 008 em staging, todas instâncias legadas compatíveis com filtro, canário e rollback — não ativar projetores concorrentes.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/REFERENCIA-TECNICA.md)

> L48: Tabelas e migrações precisam de ownership e prova de aplicação; arquivo SQL presente não equivale a mudança executada.

> L50: \| Arquivo SQL encontrado \| Banco/owner e estado \|

> L52: \| [001_whatsapp_accounts.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/001_whatsapp_accounts.sql) \| A confirmar com o manifesto de migração \|

> L53: \| [002_whatsapp_inbound.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/002_whatsapp_inbound.sql) \| A confirmar com o manifesto de migração \|

> L54: \| [003_whatsapp_outbound_inbox.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql) \| A confirmar com o manifesto de migração \|

> L55: \| [004_whatsapp_conversation_phone.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/004_whatsapp_conversation_phone.sql) \| A confirmar com o manifesto de migração \|

> L56: \| [005_whatsapp_history.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/005_whatsapp_history.sql) \| A confirmar com o manifesto de migração \|

> L57: \| [006_whatsapp_contact_names.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/006_whatsapp_contact_names.sql) \| A confirmar com o manifesto de migração \|

> L58: \| [007_whatsapp_delivery_receipts.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/007_whatsapp_delivery_receipts.sql) \| A confirmar com o manifesto de migração \|

> L59: \| [008_whatsapp_projection_owner.sql](https://github.com/delmacy/syndes-system/blob/main/modules/whatsapp/sql/008_whatsapp_projection_owner.sql) \| A confirmar com o manifesto de migração \|

> L63: Nenhuma tabela pode ser atribuída ao Control por inferência; confirmar owner e schema. Negócio do cliente fica no Tenant DB.

> L68: - **Próximo passo:** auditar classes/exports, contratos, telas, tabelas, testes e evidências sem inventar funcionalidades.

> L76: \| Plugin NestJS e domínio TypeScript \| `modules/whatsapp/src/plugin.ts` e `modules/whatsapp/src/` \| APIs, contas, contratos, regras, outbox e migrations de negócio \|

> L79: **Banco:** as sessões do Whatsmeow utilizam armazenamento PostgreSQL dedicado ao adaptador, conforme seu README. É distinto do **Tenant DB** (contas/mensagens de negócio) e do **Control/Manager DB**. Não pressupor migrations já aplicadas.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/04-contratos-e-dependencias-publicas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L10: - SQL do módulo: `modules/whatsapp/sql/001_whatsapp_accounts.sql` até `008_whatsapp_projection_owner.sql`; migrações em tenant real somente com autorização e restore.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
