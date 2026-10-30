# INBOX-02 — Persistência e API core de conversation

- **Módulo/gate:** Inbox / Sprint 1.
- **Classificação:** `MVP`.
- **Owner:** OpenCode Free (NVIDIA); Codex revisa.
- **Dependência:** Sprint 0 spec/contrato congelados; não depende de INBOX-01 para schema e rotas, mas assignment só aceita memberships ativos.

## Objetivo

Implementar a migration tenant e APIs de leitura/ação do Inbox sem depender de provider real. Persistir conversations, messages e notas privadas no database do tenant, reusando Person/Organization do Core CRM.

## Escopo permitido

- Novos arquivos sob `apps/api/src/modules/inbox/**`.
- Nova migration tenant e entradas de journal/snapshot sob `apps/api/drizzle/tenant/**`.
- Wiring mínimo do novo módulo em `apps/api/src/app.module.ts` e testes diretos.
- Contratos HTTP frozen em `docs/product/PRD-002-INBOX-SPEC.md`.

## Não tocar

Membership controller/UI; Core CRM schema/semântica; BFF/UI; provider WhatsApp/email real; mudanças no Control Plane schema; endpoints que aceitem tenant/database do cliente.

## Regras de domínio

- `conversation` referencia Person CRM quando identificada; não duplica dados canônicos. Conversa sem pessoa vinculada fica somente visível ao `tenant_admin` até ser associada pelo fluxo CRM autorizado.
- `message` guarda author actor, tipo, horário, conteúdo validado e referência externa/idempotency quando houver. Nota privada é distincta de resposta pública.
- Ordenação estável por timestamp e desempate permanente; IDs de actor são armazenados como referências sem FK cross-database.
- Status somente `open`, `pending`, `resolved`; assignment para null ou membership ativo do mesmo tenant.
- Listagem, detalhe, mensagens e mutações usam `TenantContext` e filtram `customer_scope` no backend.

## APIs

Implementar GET fila/detalhe/mensagens, PATCH assignment/status, POST public message/private note conforme a spec. Public reply depende de uma porta de envio interna; retornar status honesto sem alegar entrega antes da confirmação do channel adapter.

## Aceite e evidência

- Migration se aplica em DB tenant vazio e reaplicação é no-op segundo runner Drizzle; teste PostgreSQL descartável no CI.
- Integração prova admin/member, assignment para actor ativo/inativo/desconhecido, conversas linked/unlinked, escopo CPF/PJ/Both e tenant A/B.
- Testes cobrem validation, status transitions, private/public separation, pagination, stable message order, actor attribution e event audit.
- Lint/typecheck/unit/integration/build relevantes passam; reportar comandos e outputs. Não executar E2E.

## Revisão e aceite Codex — 2026-10-28

- **Estado:** aceita para liberar INBOX-03.
- Cursor de mensagens usa comparação PostgreSQL `(created_at, id)` contra os valores armazenados no registro cursor; teste de regressão com timestamps `.123456`/`.123457` foi demonstrado falhando com a implementação anterior e passando com a correção.
- Auditoria de atribuição negada inclui o `resource_id` da conversa conhecida e tem asserção de integração.
- PostgreSQL Inbox descartável: 19/19; migração CRM descartável: 3/3; unitários: 38 suites/232 testes; typecheck, lint e build passaram.
- A integração CRM Core e a suíte de integração completa não foram executadas porque o `.env` local aponta para um banco compartilhado `postgres` e a spec CRM Core trunca tabelas do Control Plane. Nenhum banco temporário ficou para trás; `.env` permaneceu intacto.
- Sem commit, push, deploy ou execução E2E.
