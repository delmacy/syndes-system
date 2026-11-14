# P05 — Gestão de Atendimentos | Auditoria estática de código

> **Auditoria parcial — 2026-11-13, 20:59 BRT.** Base GitHub `main` `3a943ea518df2239525d2f518bb1b061671bc358`. Fonte existente **não** é teste executado, deploy, habilitação de módulo nem Product Gate. Este documento é um checkpoint de auditoria isolado, não altera STATUS/escopo canônicos.

## Owner e fronteiras

- Catálogo e README P05 atribuem ownership a `modules/service-management`, pacote privado `@syndes/service` versão 0.3.0.
- `src/index.ts` exporta `service.js`; manifesto declara `.` e `./plugin` como subpaths compilados. `src/plugin.ts` exporta `syndesPlugin` e classes HTTP, com permissões `service:funnels`, `service:attendances`, `service:teams` (read/write).
- Dependências declaradas no serviço: `platform`, `organizations`, `crm`, `inbox`. Não atribuir tabelas de Workforce, CRM, Inbox ou autorização FGA ao P05. A seleção de organização/workspace é explícita; não inferir ativação multi-org.
- `ServiceFunnelService` recebe CoreKernel e TrustedTenantTransactionProvider; `run()` usa `executeModule` antes de selecionar transação do tenant, verifica tenant fixado, memberships ativas e papel de negócio. `byConversation()` requer adicionalmente autorização do módulo Inbox. Não tratar validação de cabeçalhos como prova de permissão efetiva.

## Contratos públicos, internos e HTTP

- `ServiceManagementHost`, `ServiceManagementController`, `ServiceManagementHttpModule` definidos em `src/controller.ts`. O Host valida tenant UUID, bearer e ator user, além de cabeçalhos `x-syndes-organization-id` e `x-syndes-workspace-id`; ausência/invalidez de seleção produz 403. Não confiar nesses cabeçalhos isoladamente: a verificação no serviço é obrigatória.
- Base declarada: `/v1/tenants/:tenantId/service-management`. **12 handlers**: GET/POST `funnels`, GET `funnels/:funnelId/board`, GET `teams`, POST `attendances`, GET `conversations/:conversationId/attendances`, GET `attendances/:id`, GET `attendances/:id/events`, PATCH `attendances/:id/stage`, PATCH `attendances/:id/assignment`, PATCH `attendances/:id/team`, POST `attendances/:id/close`.
- O controller mapeia `ServiceFunnelInputError` a 400, `ServiceFunnelConflictError` a 409, `AccessDeniedError` a 403, códigos PG 23505/23514/23503 a 409 e falhas não classificadas a 503. A autenticação inválida retorna 401. **Ponto a revisar:** `ServiceManagementHost.run()` envolve apenas a chamada da operação em try/catch; erros HTTP originados dentro do callback (como o 404 em `get`) passam por `status()`, que não preserva `HttpException`? A função `status()` preserva `HttpException`; portanto 404 permanece 404. Sem teste HTTP executado.
- `ServiceFunnelService` inclui `listFunnels`, `publishSimpleFunnel`, `open`, `byConversation`, `get`, `advance` e outras operações a completar em inspeção posterior. `open` usa chave de idempotência por tenant/org/workspace, reenvio compatível retorna protocolo existente, payload/ator divergente gera conflito; transições exigem `expectedVersion` positivo. Métodos internos não são automaticamente contratos públicos estáveis.
- Não foi localizado contrato de publicação no Event Bus C06 nos arquivos inspecionados. A tabela de histórico registra eventos SQL de negócio, **não** demonstra emissão no barramento.

## Schemas e migrations

- `src/plugin.ts` registra três migrations de tenant: `001_service_funnels.sql`, `002_service_team_transfer.sql`, `003_service_conversation_inspector.sql`. Não executar nem assumir aplicação.
- SQL 001 declara schema `service` sob installer confiável, tabelas `service_funnels`, `service_funnel_stages`, `service_attendances`, `service_attendance_events`, FKs compostas tenant/org/workspace, versão otimista e triggers de integridade/auditoria. Depende de Organizations 001–003, CRM 001/003, Inbox 001.
- SQL 002 adiciona equipe, transferência e funções `service_team_is_supervisor` / `service_team_can_read`, com preflight exigindo Workforce 007 e índices legados. Não habilitar sem aprovação, staging e restore.
- SQL 003 acrescenta índice para consulta read-only por conversa, com preflight de Service 002, Inbox e Workforce 007. Não demonstra que a projeção esteja operacional.
- **Risco de acoplamento:** SQL 002 consulta tabelas de CRM, Workforce e memberships; ownership dessas tabelas continua externo. Revisar compatibilidade de versões, grants e negativas entre tenants antes de homologação.

## Documentação ↔ código

- `STATUS.md` ainda afirma `SEM AUDITORIA FUNCIONAL`; permanece correto quanto a homologação, mas não reflete o inventário de classes/rotas realizado aqui.
- `REFERENCIA-TECNICA.md` ainda diz `A AUDITAR` para classes/métodos e não enumera as 12 rotas, apesar de identificar manifesto e três SQL. **Divergência documental parcial confirmada**; reconciliar por PR de documentação após revisão, preservando o estado não homologado.
- `ESCOPO.md` declara rascunho não aprovado; não alterar a aprovação por inferência.
- A contagem de handlers é uma contagem estática do controller, não prova de rotas montadas no Host.

## Evidências, limites e próximos gates

| Eixo | Resultado |
|---|---|
| Fonte e exports | Inspecionados em GitHub na SHA base |
| Classes e HTTP | Controller completo e parte do serviço inspecionados |
| Persistência | Três SQL e manifesto inspecionados; nenhuma migration aplicada |
| Eventos | Histórico SQL encontrado; Event Bus não comprovado |
| Testes | `npm test` declarado no manifesto; **nenhum teste executado** |
| Testes de código | Nome `test/service.test.mjs` tentado e não encontrado; não significa ausência de testes |
| DevServer / ambiente | Não acessado |
| Integração / deploy / homologação | Não verificados |
| Segurança | Verificações declaradas; negativas HTTP e A/B ainda não testadas |
| Publicação GitHub Pages | SHA público não verificado |

**Próximas verificações:** localizar testes reais do pacote e demais métodos do serviço, inspecionar trigger SQL 001/002 integralmente, comparar contratos com chapters/04 e 05, executar somente testes isolados autorizados, verificar CI por SHA, matriz tenant A/B, idempotência, concorrência, erros HTTP e Product Gate. Depois submeter reconciliação documental à revisão; não modificar código/SQL/infra/workflows ou branches alheias.

**Fontes:** [manifesto](https://github.com/delmacy/syndes-system/blob/3a943ea518df2239525d2f518bb1b061671bc358/modules/service-management/package.json), [service](https://github.com/delmacy/syndes-system/blob/3a943ea518df2239525d2f518bb1b061671bc358/modules/service-management/src/service.ts), [controller](https://github.com/delmacy/syndes-system/blob/3a943ea518df2239525d2f518bb1b061671bc358/modules/service-management/src/controller.ts), [plugin](https://github.com/delmacy/syndes-system/blob/3a943ea518df2239525d2f518bb1b061671bc358/modules/service-management/src/plugin.ts), [SQL 001](https://github.com/delmacy/syndes-system/blob/3a943ea518df2239525d2f518bb1b061671bc358/modules/service-management/sql/001_service_funnels.sql), [SQL 002](https://github.com/delmacy/syndes-system/blob/3a943ea518df2239525d2f518bb1b061671bc358/modules/service-management/sql/002_service_team_transfer.sql), [SQL 003](https://github.com/delmacy/syndes-system/blob/3a943ea518df2239525d2f518bb1b061671bc358/modules/service-management/sql/003_service_conversation_inspector.sql).
