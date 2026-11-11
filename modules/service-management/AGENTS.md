# Gestão de Atendimentos — módulo PRD-003A

- **Ownership:** protocolo, funil, etapa, atribuição, resultado e trilha histórica. A Inbox é dona da conversa e mensagens; CRM é dono do contato. Support Syndes continua separado.
- Escopo Basic: 2–8 etapas escolhidas pelo cliente, exatamente uma terminal, ordenadas. Sem editor visual, templates, motor genérico, políticas de SLA, equipes fictícias ou múltiplas organizações desbloqueadas.
- O pacote agora fornece um **plugin NestJS instalável, ainda NÃO montado no Host**. A referência package no Dockerfile/Host instala binários sem alterar `config/modules.json`; portanto não há rota operacional, menu ou migration ativa. O gate seguinte é Control Module ENABLED + FGA real + roles SQL + restore homologado.
- `ServiceFunnelService` exige `CoreKernel.executeModule` (tenant + FGA por recurso + Control ENABLED fail-closed), ator `user`, transação pinned `TrustedTenantTransactionProvider`, membership Organization/Workspace ativo. SQL trigger exige `syndes.service_actor_id` definido em transação, valida mudanças e gera eventos append-only no mesmo commit.
- Sem autorização por `assigned_to` sozinho: attribution não concede acesso; só membros existentes e ativos podem assumir. UI não controla DSN nem cria membership.
- Testes de PG17+Nest HTTP exigem fixture isolada e tokens sintéticos explicitamente autorizados, nunca utilizar banco operational. PRD em `docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md`, WBS em `docs/engineering/WBS-GESTAO-ATENDIMENTOS-MVP-20261111.md`.
