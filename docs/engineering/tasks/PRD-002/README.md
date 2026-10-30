# PRD-002 Inbox — task index

Ordem executável: [Sprint Plan](../../PRD-002-INBOX-SPRINT-PLAN.md). Product Gate e contratos: [spec](../../../product/PRD-002-INBOX-SPEC.md).

| Task | Título | Dependência | Owner inicial | Estado |
|---|---|---|---|---|
| [INBOX-01](INBOX-01-membership-lifecycle.md) | Membership de atendentes: conceder/revogar actor existente | Sprint 0 | OpenCode Free (NVIDIA) | Em execução; revisão pediu validação runtime/testes adicionais (`ctx_14d334cd144e`) |
| [INBOX-02](INBOX-02-conversation-api.md) | API/persistência de conversas, mensagens, notas, atribuição e status | Sprint 0 | OpenCode Free (NVIDIA) | Aceita por Codex após revisão; integrações descartáveis 19/19 + 3/3, unitários 232/232, lint/typecheck/build verdes |
| [INBOX-03](INBOX-03-channel-fake.md) | Contrato de canal e fake adapter | INBOX-02 | OpenCode Free (NVIDIA) | Aceita por Codex; API checks e integração PostgreSQL descartável verdes |
| [INBOX-04](INBOX-04-realtime-attachments.md) | Realtime autenticado e anexos | INBOX-02, INBOX-03 | OpenCode Free (NVIDIA) | Aceita/release; INBOX-05 desbloqueada para execução |
| [INBOX-05](INBOX-05-nextjs-inbox.md) | Frontend Next.js de atendimento | INBOX-02, INBOX-04 | OpenCode Free (NVIDIA) | Em correção (R1); evidência web registrada em `INBOX-05-nextjs-inbox.md`; gate Codex pendente |
| [INBOX-06](INBOX-06-integrated-acceptance.md) | Revisão integrada e Product Gate | INBOX-01–05 | Codex | Bloqueada |

Não misturar tasks com outros módulos; cada comportamento alterado recebe os testes apropriados antes da revisão. A revisão/aceitação cabe ao Codex e não ao worker que implementou.
