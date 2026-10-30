# INBOX-02-R3 — Revisão e fechamento da API central do Inbox

- **Sprint:** 1 / correção de integração
- **Classificação:** `BUG` + `BLOCKER` de integração
- **Owner executor:** worker `opencode2` com fallback exclusivamente NVIDIA
- **Owner de aceite:** coordenação/Codex
- **Dependências:** PRD-002 Sprint 0; Core CRM CRM-11; INBOX-01 revisada

## Contexto

O preflight de INBOX-06 encontrou divergência entre o contrato congelado e a árvore. Há uma implementação local e um relatório R2, mas a entrega original veio de dispatch inativo e não pode ser aceita automaticamente. Esta tarefa exige verificar o estado real, corrigir somente gaps comprovados e produzir evidência válida no dispatch ativo.

## Escopo permitido

- `apps/api/src/modules/inbox/**`;
- migration/journal/snapshot de tenant somente quando necessário para o schema Inbox;
- testes diretos do Inbox;
- este relatório.

## Não tocar

Frontend, auth global, billing, WhatsApp/Email reais, CRM schema não relacionado, artefatos temporários, commit ou push.

## Critérios de aceite do worker

- Rotas congeladas sob `/api/v1/inbox/conversations` estão registradas e não são stubs.
- Persistência Drizzle usa `TenantContext` server-side e rejeita seleção de tenant pelo cliente.
- `customer_scope` (`cpf`, `pj`, `both`) e conversa sem Person são filtrados antes de dados, contagens, mutações e eventos.
- Assignment aceita somente membro ativo do mesmo tenant; status é limitado a `open`, `pending`, `resolved`.
- Mensagem pública exige `Idempotency-Key`, nota privada não usa outbound e falhas não alegam entrega.
- Testes unitários e integração PostgreSQL descartável cobrem authz, A/B, escopo, ordering, dedupe/retry e auditoria sem conteúdo.
- `lint`, `typecheck` e `build` da API passam.

## Entrega

O worker deve enviar arquivos, comandos/resultados, limitações ambientais e caminho do relatório. Não deve declarar aceite nem criar commit.
