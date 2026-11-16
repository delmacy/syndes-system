# P05 — Matriz de ações e contratos HTTP

> **Leitura do código em 1cf48cc0a1, 16/11/2026.** 12 decorators HTTP encontrados, mas nenhum teste, deploy, grant ou migration foi executado nesta edição. Código ≠ operação homologada.

| ID estável | Ação | Rota relativa a `/v1/tenants/:tenantId/service-management` | Método interno | Recurso | Regra visível no código |
|---|---|---|---|---|---|
| `p05-funnels-list` | Listar funis | `GET funnels` | `ServiceFunnelService.listFunnels` | `service:funnels/read` | Somente published e escopo do workspace |
| `p05-funnels-publish` | Publicar funil | `POST funnels` | `ServiceFunnelService.publishSimpleFunnel` | `service:funnels/write` | 2–8 etapas e códigos únicos; última terminal |
| `p05-board` | Consultar quadro | `GET funnels/:funnelId/board` | `ServiceFunnelService.board` | `service:attendances/read` | Somente protocolos open e equipes autorizadas |
| `p05-teams` | Consultar equipes | `GET teams` | `ServiceFunnelService.listTeams` | `service:teams/read` | Workforce ativo e staffed |
| `p05-attendance-open` | Abrir protocolo | `POST attendances` | `ServiceFunnelService.open` | `service:attendances/write` | idempotencyKey, published funnel, conversa opcional |
| `p05-inspector` | Atendimentos por conversa | `GET conversations/:conversationId/attendances` | `ServiceFunnelService.byConversation` | `service:attendances/read + inbox:conversations/read` | Duplo gate Inbox e Service; conversa no workspace corrente |
| `p05-attendance-get` | Consultar protocolo | `GET attendances/:id` | `ServiceFunnelService.get` | `service:attendances/read` | Filtro por equipe e escopo tenant/org/workspace |
| `p05-attendance-history` | Consultar histórico | `GET attendances/:id/events` | `ServiceFunnelService.history` | `service:attendances/read` | Trilha SQL com limite 200 |
| `p05-stage` | Mover etapa | `PATCH attendances/:id/stage` | `ServiceFunnelService.advance` | `service:attendances/write` | Versão CAS, etapa adjacente, somente estado open |
| `p05-assign` | Atribuir operador | `PATCH attendances/:id/assignment` | `ServiceFunnelService.assign` | `service:attendances/write` | Membership ativo, equipe permitida e versão esperada |
| `p05-transfer` | Transferir equipe | `PATCH attendances/:id/team` | `ServiceFunnelService.transferTeam` | `service:attendances/write + service:teams/write + team FGA` | Grants de origem/destino, supervisor, motivo e CAS |
| `p05-close` | Encerrar protocolo | `POST attendances/:id/close` | `ServiceFunnelService.close` | `service:attendances/write` | Etapa terminal, result e versão esperada |

**Fontes:** [controller](https://github.com/delmacy/syndes-system/blob/1cf48cc0a1281017ac58f7b9b9747f663109e151/modules/service-management/src/controller.ts), [service](https://github.com/delmacy/syndes-system/blob/1cf48cc0a1281017ac58f7b9b9747f663109e151/modules/service-management/src/service.ts), [plugin](https://github.com/delmacy/syndes-system/blob/1cf48cc0a1281017ac58f7b9b9747f663109e151/modules/service-management/src/plugin.ts).

## Matriz de diagramas e cobertura

| Tipo | Campo de observação | Estado |
|---|---|---|
| Contexto / ownership | P05 × CRM × Inbox × Workforce × Host | PENDENTE |
| Componentes | Controller, Service, CoreKernel, Tenant SQL | PENDENTE |
| Sequência | Publish → open → advance → close e casos de erro | PENDENTE |
| Estados | draft/published, open/closed e estágio atual | PENDENTE |
| ERD | service_funnels, stages, attendances, audit events | PENDENTE |
| Segurança | JWT, tenant/org/workspace, FGA, membros e equipes | PENDENTE |
| Deploy | Plugin opt-in, migrations, grants, restore | NÃO HOMOLOGADO |

**Edge cases para revisão:** idempotencyKey repetida com payload divergente; versão CAS obsoleta; etapa não adjacente; fechamento fora de etapa terminal; atribuição sem membership; transferência sem grant FGA de ambas equipes; Inspector com Inbox negado; tenant A→B. São **casos candidatos, não testes PASS**.

**Persistência:** migrations `001_service_funnels.sql`, `002_service_team_transfer.sql`, `003_service_conversation_inspector.sql` em `modules/service-management/sql`. A existência desses arquivos não demonstra aplicação em ambiente real.

**Testes presentes:** `service-validation.test.mjs`, `http-adapter.test.mjs`, `service-funnels-pg17.test.mjs`; execução e evidências independentes ainda pendentes.
