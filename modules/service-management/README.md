# Syndes Service Management (PRD-003A)

Primeiro incremento de domínio do **funil essencial de atendimento**: funis configurados com etapas simples, protocolo persistido, vínculo opcional à Inbox, abertura idempotente por requisição, atribuição de operador autorizado, progressão manual, conclusão e auditoria append-only.

**Plugin e API NestJS disponíveis em código, mas NÃO montados no Core Host operacional.** O pacote é dependência build-time do Host, com peers NestJS compartilhados, porém `apps/core-host/config/modules.json` não o inclui. Nenhuma migration de tenant, menu, provider ou grant operacional foi publicado. As rotas usam headers explícitos `x-syndes-organization-id`/`x-syndes-workspace-id`, sem fallback ao contexto default, e `CoreKernel.executeModule`, que rejeita módulo não ENABLED. O módulo requer Kernel autorizado e provider transacional confiável fornecidos pelo Host **após** os gates de release. A migração `sql/001_service_funnels.sql` é exclusivamente de instalação operator-gated e depende de Organizations/CRM/Inbox. Não a execute em ambiente operacional sem restore e autorização.

Referências: `docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md` e `docs/engineering/WBS-GESTAO-ATENDIMENTOS-MVP-20261111.md`.

## Equipes Workforce (versão 0.2.0, código opt-in)

O pacote expõe `GET /v1/tenants/:tenantId/service-management/teams` e `PATCH /v1/tenants/:tenantId/service-management/attendances/:id/team` (`destinationTeamId`, `expectedVersion`, `reason`), **somente se o plugin for explicitamente ativado pelo Host após homologação**. A transferência preserva protocolo/conversa e histórico, limpa responsável antigo e exige grants OpenFGA de origem e destino e supervisor real. Instalação ordenada de `Organizations/007_staff_roles_pre_release.sql` (manual), `Service/001` e `Service/002` após backup/restore, Control attestation e grants. Consulte `ADR-SERVICE-WORKFORCE-TEAM-TRANSFER-20261111.md`; não use endpoints nem a migration em produção sem gates.

## Inspector Inbox — lookup por conversa (v0.3.0, opt-in)

`GET /v1/tenants/:tenantId/service-management/conversations/:conversationId/attendances` retorna protocolos autorizados (abertos e encerrados) vinculados à conversa. Requer JWT e seletores Organization/Workspace, FGA/ENABLED de Inbox e Service, ownership atual da conversa e visibilidade da equipe. Sem mensagens nem dados pessoais; `003_service_conversation_inspector.sql` adiciona um índice parcial após Service 002. Limite de 50 resultados, sem paginação neste MVP. Contrato e gates: `docs/engineering/ADR-SERVICE-INBOX-INSPECTOR-READ-20261111.md`. A interface não é criada neste pacote.
