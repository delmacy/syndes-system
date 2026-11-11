# Gestão de Atendimentos — módulo PRD-003A

- **Ownership:** protocolo, funil, etapa, atribuição, resultado e trilha histórica. A Inbox é dona da conversa e mensagens; CRM é dono do contato. Support Syndes continua separado.
- Escopo Basic: 2–8 etapas escolhidas pelo cliente, exatamente uma terminal, ordenadas. Sem editor visual, templates, motor genérico, políticas de SLA, equipes fictícias ou múltiplas organizações desbloqueadas.
- O pacote agora fornece um **plugin NestJS instalável, ainda NÃO montado no Host**. A referência package no Dockerfile/Host instala binários sem alterar `config/modules.json`; portanto não há rota operacional, menu ou migration ativa. O gate seguinte é Control Module ENABLED + FGA real + roles SQL + restore homologado.
- `ServiceFunnelService` exige `CoreKernel.executeModule` (tenant + FGA por recurso + Control ENABLED fail-closed), ator `user`, transação pinned `TrustedTenantTransactionProvider`, membership Organization/Workspace ativo. SQL trigger exige `syndes.service_actor_id` definido em transação, valida mudanças e gera eventos append-only no mesmo commit.
- Sem autorização por `assigned_to` sozinho: attribution não concede acesso; só membros existentes e ativos podem assumir. UI não controla DSN nem cria membership.
- Testes de PG17+Nest HTTP exigem fixture isolada e tokens sintéticos explicitamente autorizados, nunca utilizar banco operational. PRD em `docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md`, WBS em `docs/engineering/WBS-GESTAO-ATENDIMENTOS-MVP-20261111.md`.

## Transferência intra-Workspace (SM-04, incorporada à v0.3.0)

`002_service_team_transfer.sql` exige Workforce Organizations 007 pré-release manual e SQL002 ativo. Não aplicar em databases operacionais nem alterar grants. `transferTeam` exige módulo ENABLED, FGA de atendimentos/teams e FGA dinâmica origem/destino; ator deve ter staff designation supervisor e vínculo real CRM/Workspace, destino com agente elegível. Mesma conversa, mesmo protocolo, versão CAS, limpa assignee, escreve motivo e auditoria append-only. GET/board/histórico e alterações filtram membros ativos da equipe atual; revogação remove visão. Sem cross-org, cross-workspace, motor de SLA ou frontend até Product Gate.

## Contrato Inspector (v0.3.0)

`byConversation` e endpoint GET correspondente usam `Kernel.executeModule(inbox)` mais `Kernel.executeModule(service)` e verificação de `platform_current_workspace_id` no SQL. Apenas até 50 protocolos visíveis, sem textos de conversa nem nome de contato; entidade Inbox permanece dona da conversa. `003_service_conversation_inspector.sql` apenas cria índice parcial, após Workforce 007 e Service 002, e nunca deve ser aplicado automaticamente a bancos operacionais. Nenhuma alteração no frontend sem Product Gate.


## Instalação Control/Installer — SM-03C corrigido, gates operacionais pendentes

Pacote `@syndes/service`, descriptor e Kernel usam `service`, com recursos FGA `service:funnels`, `service:attendances`, `service:teams` e `service:team:<uuid>`; a URL pública continua `/service-management`. SQL 001–003 em schema `service`, FKs `public`, sem BEGIN/COMMIT próprios. `apps/core-host/src/service-release.ts` lê scripts empacotados e calcula checksums para instalador operator-only. Preflight de código agora passa; controle operational segue **blocked** por ausência de restore real, Control ENABLED, Workforce 007/ledger e grants OpenFGA. Não habilitar rota, menu nem aplicar DDL operacional. Ver ADR-SERVICE-CANONICAL-INSTALLER-SM03C-20261111.
