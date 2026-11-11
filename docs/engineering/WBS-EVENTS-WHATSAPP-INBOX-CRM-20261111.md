# WBS — PR3 WhatsApp / Inbox / CRM sobre Platform Events

| ID | Entrega | Estado | Gate/evidência |
|---|---|---|---|
| WA-E01 | Contrato `whatsapp.message.received.v2` com referência BIGINT decimal | Implementado em worktree | unit tests de contrato |
| WA-E02 | Publicação WhatsApp inbound + outbox no mesmo COMMIT | Implementado em worktree | rollback PG17; ponte opt-in |
| WA-E03 | Porta de leitura scoped de inbound e comando de rota/ack | Implementado em worktree | PG17 integrado, sem SQL cross-owner de escrita |
| IN-E01 | Inbox consome inbound e publica ParticipantObserved | Implementado em worktree | rollback/crash/idempotência PG17 |
| CRM-E01 | CRM lê identidade e publica resolved/review | Implementado em worktree | identidade exata, ausência e ambiguidade PG17 |
| IN-E02 | Inbox valida novamente pessoa/escopo e grava vínculo | Implementado em worktree | alteração antes do link recusa gravação |
| EV-F03 | Testes PG17 de cadeia vertical e regressão | Implementado localmente | CI GitHub pendente |
| EV-G03 | ADR, WBS, AGENTS e producer/consumer map | Implementado em worktree | revisão |
| EV-H01 | Conectar bridge/handlers no Core Host em modo de cutover seguro | **Pendente — gate** | provisionamento e rollback de projetor legado |
| EV-H02 | Identity/FGA/ENABLED real, descoberta tenant e scheduler | **Pendente — gate** | Control DB preparado e políticas |
| EV-H03 | Consumidor de review/replay e retenção/observabilidade | **Pendente — gate** | política aprovada e revisão assistida |
| EV-H04 | Validar multi-workspace e transferência autorizada | **Bloqueado** | SQL002 ativo, sem multi-org |
| EV-H05 | Control Plane Outbox e deploy operacional | **Bloqueado** | backup/restore, autorização específica |
| EV-H06 | Reconciliação dos 14 contatos operacionais | **Bloqueado** | aceite específico, só leitura até lá |

**Importante:** SQL 002 não foi removido; WhatsApp legado continua a operar por padrão. O teste integrado instancia a ponte explicitamente em database descartável. Não confundir código presente com worker ativo.
