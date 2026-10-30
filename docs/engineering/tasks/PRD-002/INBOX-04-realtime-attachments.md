# INBOX-04 — Realtime e anexos privados

- **Módulo/gate:** Inbox / Sprint 2.
- **Classificação:** `MVP`.
- **Owner:** OpenCode Free (NVIDIA); Codex revisa.
- **Dependência:** INBOX-02 e INBOX-03 aceitos.

## Objetivo e ownership

Propagar atualizações novas com autenticação/tenant/scope e permitir upload/download privado de anexos. Ownership em `apps/api/src/modules/inbox/**`, armazenamento privado configurado fora de webroot, e testes próprios. Não alterar Auth global nem módulo Documents além de consumir contratos aprovados.

## Limites

- Resolver protocolo pela sessão existente; não passar tenant ID por query/message. O client reconstrói o estado pela API após reconexão.
- Validar membership e `customer_scope` na conexão/subscription e em cada evento enviado; remoção/revogação encerra acesso.
- Armazenar metadados no tenant DB; objeto/arquivo privado por tenant, sem path controlado pelo usuário e servido apenas por endpoint autorizado.
- Definir allowlist/limite por configuração com valores padrão documentados; rejeitar MIME/extensão divergentes, payload excedente e traversal.
- Backup do storage de anexo deve estar descrito junto do procedimento do tenant; não criar URL público permanente.

## Aceite

- API typecheck/lint/build passed.
- API unit: 50 suites/355 tests passed.
- disposable PostgreSQL INBOX-04 integration: 13/13 passed using only uniquely named inbox04_* databases and cleanup.
- WebSocket gateway focused: 18/18 passed.
- attachment tests: 50/50 passed.
- Note: CRM/full integration was not run.

- Testes provam evento de outra tenant/scope não chega; auth/session inválida é rejeitada; reconnect busca estado durável.
- Upload/download cross-tenant, de conversa fora do scope e path traversal são bloqueados; arquivo inválido/grande não persiste.
- Unit/integração apropriados e checks API verdes, com logs/resultados anexados ao relatório da task.

## Referência operacional

- [Realtime WebSocket e operação de anexos (backup/restore, symlink, limites)](../../INBOX-04-REALTIME-ATTACHMENT-OPERATIONS.md)
