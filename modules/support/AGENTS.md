# AGENTS.md — Core Support
Produto: exclusivamente o atendimento do **tenant operacional Syndes**. Escopo da issue #32 e PRD/ADR/WBS Syndes Support prevalecem sobre suposições.

- Não instalar outro helpdesk nem criar sistema CRM/Inbox paralelo.
- Configuração server-side de tenant Syndes; não inferir do parâmetro HTTP.
- Verificação Keycloak + tenancy + OpenFGA ANTES de resolver DB; SQL verifica solicitante/membro da fila.
- Sem privilégios implícitos de Platform Manager; nada de consultas em tenant de cliente.
- Separar tipos de ticket, filas, autorizações, eventos e dados.
- Toda mutação auditada atomicamente. Notes nunca são outbound.
- SQL aditivo e idempotente; sem dados reais em testes.
- Testes negativos tenant/queue/actor/UUID, regressão e PG antes de release.
- Sem SSE, SLAs, IA, dashboards, API de grants, botões ou filtros não planejados.
