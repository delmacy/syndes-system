# INBOX-06 — Revisão integrada e Product Gate final

- **Módulo/gate:** Inbox integrado / Sprint 4.
- **Classificação:** `MVP`.
- **Owner:** Codex coordena/revisa/aceita.
- **Dependência:** INBOX-01–05 implementadas e revisadas individualmente.

## Objetivo

Provar a jornada Inbox de ponta a ponta no contrato Syndes com fake channel, tenant databases descartáveis, memberships reais de teste e artefatos revisáveis. Corrigir gaps somente com task de follow-up e ownership explícito.

## Trabalho

- Matriz requisito → source → teste → evidência para todo PRD-002.
- Rodar unit/component/integration/migration, authz, cross-tenant, realtime e attachment checks do CI; revisar failures/logs.
- Confirmar que o tenant manager não lê conteúdo de conversations e que messages privadas não chegam ao fake outbound.
- Preparar script Playwright headless com login/seed isolados por execução, JSON/logs por etapa e teardown seguro; executar apenas quando gate explícito e revisar os artefatos.
- Confirmar configuração/backup/restore de anexos antes de declarar DoD operacional.

## Não fazer

- Não conectar WhatsApp real neste gate (PRD-003); não criar automações, dashboards ou workers de campanha.
- Não tratar CI verde isoladamente como aceite; não enfraquecer testes; não mergear/publicar/deployar sem etapa autorizada.

## Aceite

- Jornada demonstrável: fake inbound → fila → admin/member assignment autorizado → resposta pública → nota privada → status → attachment → evento realtime → reconnect e estado persistido.
- Matriz cobre `cpf`, `pj`, `both`, membro ativo/revogado, tenant A/B, conversation sem Person, mensagens duplicadas/atrasadas e anexos invalid/cross-tenant.
- CI relevante verde, outputs revisados e logs sem tokens/secrets. E2E fica apontado como necessário; só rodar pelo fluxo headless com artefatos.
- Revisão de segurança e usabilidade aprovada; decisão formal `ACEITO`, `CORREÇÕES NECESSÁRIAS` ou `BLOQUEADO` com próximo responsável.
