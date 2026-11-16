# P02 Inbox · Atribuir ou liberar responsável · `p02-assignment-set`

> **Ficha de ação · template v1.0.0 congelado · 16/11/2026.** Código identificado na SHA `24018b354392`; **não equivale a requisito aprovado, teste executado, integração ativa, deploy ou homologação**. Requisitos: [ESCOPO](../ESCOPO.md), evidências: [STATUS](../STATUS.md).

## A. Identidade e estado

| Campo | Referência |
|---|---|
| Owner | P02 `modules/inbox` |
| Função | `atendimento`, [matriz](../MATRIZ-ACOES.md) |
| ID estável | `p02-assignment-set` |
| Estado do código | DECLARADO NO CÓDIGO |
| Testes | 34 PASS históricos na auditoria 12/11; **não reexecutados nesta ficha** |
| Integração/implantação/aceite | **NÃO HOMOLOGADOS** |
| Novo requisito autorizado | NENHUM |

## B. Intenção e regra do domínio

**História descritiva, não aprovada como novo requisito:** como operador ou serviço devidamente autorizado, quero **atribuir ou liberar responsável**, respeitando tenant, organização, workspace e as fronteiras de outros owners.

**Regra implementada (P02-ASSIGN-01):** ator deve possuir `inbox:assignment/write`; destinatário não nulo precisa de memberships **ativas com papel `admin` ou `editor` na mesma organização e no workspace atual da conversa**. Organização e workspace precisam estar ativos. O ID continua limitado a 128 caracteres; `null` libera o responsável. A elegibilidade é verificada pela SQL antes de gravar, sem nova concessão FGA.

## C. Fluxo e edge cases

**Implementação revisada (P02-ASSIGN-01):** `InboxService.assign` mantém o gate `inbox:assignment/write`; `PgInboxRepository.assign` resolve o destinatário via `platform_org_memberships` + `platform_workspace_memberships` e verifica organização/workspace ativos da **conversa atual**, dentro da mesma instrução SQL `WITH eligible ... FOR SHARE` + `UPDATE` + `audit`. Assim, uma revogação ou transferência concorrente não deve usar uma checagem antecipada stale. Não muda nenhum schema ou tabela de P04.

**Rejeições:** alvo inexistente, viewer, revogado ou de outro workspace/org => `null` no repositório / **404 genérico** pelo controller, sem notificação SSE nem auditoria. Permissão negada do **ator** => 403; ID malformado => 400. Atribuição idêntica para membro ainda elegível => retorno sem novo audit; idêntica para alvo revogado => 404; liberação por `null` não depende de elegibilidade do antigo responsável.

**Limitações:** memberships `editor/admin` são proxy operacional definido para este incremento; não se verifica uma concessão OpenFGA individual do destinatário nem sua sessão Keycloak. Dados antigos em `assigned_to` não são corrigidos retroativamente. É necessário ter migrações P04 e backfill aplicados no ambiente antes de ativar a operação.

[Confronto de código, owners e decisões](../PARIDADE-CODIGO.md).

1. Conferir identidade e contexto confiáveis antes de executar o método HTTP.
2. Validar entrada e autorização segundo o código e contratos versionados.
3. Executar `InboxService.assign` somente no contexto permitido.
4. Observar persistência, idempotência, auditoria e notificação, quando aplicáveis.

**Exceções propostas (NÃO são testes PASS):**

- **EC-01** — destinatário inexistente, viewer ou revogado (404 genérico).
- **EC-02** — ator sem `inbox:assignment/write` (403 antes do banco).
- **EC-03** — destinatário de outro tenant/org/workspace ou workspace arquivado.
- **EC-04** — idempotência para mesmo destinatário e liberação repetida.
- **EC-05** — destinatário revogado após uma atribuição anterior: não confirmar o no-op.
- **EC-06** — transição concorrente de workspace ou revogação de membership.

Consultar [diagramas](../DIAGRAMAS.md) como modelo de código, não evidência operacional.

## D. Contratos, métodos e APIs

| Campo | Descrição |
|---|---|
| Método e endpoint | `PATCH /v1/tenants/:tenantId/inbox/conversations/:id/assignment` |
| Método | `InboxService.assign` |
| Entrada | `assigneeId string ou null` |
| Permissão/contexto | `inbox:assignment/write` para o ator; P04 org/workspace `active` + `admin/editor` para o destinatário |
| Fonte | [`src/inbox.controller.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts) |

O endpoint declarado não está necessariamente disponível em um Host configurado, e método interno não é automaticamente um contrato público exportado.

## E. Dados e integridade

**Objetos relacionados:** `inbox_conversations; inbox_events`, leitura/lock de `platform_organizations`, `platform_workspaces`, `platform_org_memberships`, `platform_workspace_memberships` (owner P04). [SQL 001](<https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/sql/001_inbox_foundation.sql>) define a base do domínio; alterações posteriores em campos de WhatsApp, organização e workspace são dependentes de outras migrations, **sem prova de aplicação**. Não atribuir tabelas CRM/WhatsApp ao Inbox. Ver [inventário](../INVENTARIO-TECNICO.md).

## F. Segurança e isolamento

| Condição | Teste a comprovar |
|---|---|
| Ausência de JWT HTTP | 401, se existe endpoint |
| Negação FGA/membership | 403 antes de exposição ou escrita |
| Parâmetros inválidos | 400 quando apropriado |
| Registro inexistente / destinatário não elegível | 404 genérico; não diferencia existência do destinatário |
| Tenant DB divergente / falha | 503 ou fail-closed |
| Tenant A/B / workspace alheio | Nunca ler, alterar ou notificar outro escopo |
| `legacy|enforce` / multi-org | Gates e índice de backfill exigem teste real |

Ver [`src/context-guard.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/context-guard.ts) e [`src/inbox.controller.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts). A tabela é uma **matriz de riscos**, não uma promessa de todos os status para esta ação.

## G. Frontend e estados visuais

UI de referência: `apps/workspace-web/src/features/inbox.tsx`, além dos assets antigos `modules/inbox/public`. Para ação com tela, validar estados vazio/carregando/erro, acessibilidade, mobile, conflito, idempotência e grants. **Consumidor de evento não exige tela independente.** Manager não tem acesso a tenant por seu papel.

## H. Eventos e dependências

Rotas dependem de Host, Kernel, FGA, Tenant DB e, quando pertinente, ports CRM e WhatsApp. Mudanças de estado podem invalidar SSE scoped em um Host; não é broker distribuído.

## I. Testes e casos Given/When/Then

**Ensaio pré-homologação:** [P02-ASSIGN-02](../PRE-HOMOLOGACAO-ASSIGN.md) adiciona teste real OpenFGA em memória e diagnóstico agregado read-only em PG17 descartável. **Importante:** o `InboxService.assign` não consulta um grant individual do destinatário e nenhum teste autoriza essa implementação automaticamente. O [Actions run 43968388949](https://github.com/delmacy/syndes-system/actions/runs/43968388949) confirmou preflight PG 1 PASS e OpenFGA descartável 5 PASS, além de 35 testes unitários Inbox e 9 Host HTTP; **Keycloak real, dados históricos de clientes, restore e Product Gate permanecem pendentes.**


Arquivos relacionados à investigação: [`test/inbox.test.mjs`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/test/inbox.test.mjs) · [`test/default-context.test.mjs`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/test/default-context.test.mjs) · [`test/frontend.test.mjs`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/test/frontend.test.mjs). **A presença não comprova cobertura individual.**

| Proposta | Dado | Quando | Então a verificar |
|---|---|---|---|
| CP-01 | Identidade e escopo válidos | Executa a ação | Contrato e dados preservados |
| CP-02 | Principal sem grant | Requisita/consome | Falha segura e sem mutação |
| CP-03 | Recurso tenant B | A tenta operar B | Rejeição completa |
| CP-04 | atribuição de ator inexistente | Reproduz exceção | Tratamento do método documentado |

**Testes executados no job `Regression / inbox` do [run 43939884169](https://github.com/delmacy/syndes-system/actions/runs/43939884169), commit `8de743e`: 35 unitários, 1 de escopo PG, 1 PG de persistência, 1 corrida/revogação e 9 Host HTTP — todos PASS.** `modules/inbox/test/pg-org-scope.mjs` (P04 memberships, A/B, workspace arquivado, revogação e auditoria), `apps/core-host/test/inbox-pg-http.integration.mjs` (HTTP 404/403) e `modules/inbox/test/scope-query.test.mjs` (SQL parametrizada) e `modules/inbox/test/pg-assignment-races.mjs` (duas atribuições concorrentes + revogação durante a operação). A suíte `pg-integration.mjs` usa fixture transacional com ROLLBACK para não contaminar o teste HTTP seguinte. **Não é teste com Keycloak/OpenFGA reais**, nem afirma deploy ou Product Gate.

## J. Decisões e handoff

**Decisão de implementação autorizada pelo responsável:** P02-ASSIGN-01, impedir novas atribuições para destinatários sem membership ativa `editor/admin` no workspace atual. Sem migração nova e sem mudança de permissões do ator. **Não abrange** revisão de Keycloak/FGA do alvo, limpeza de vínculos antigos nem criação de cargo especializado de atendente.

Agente deve ler [Ficha Mestre](../FICHA-MODULO.md), [Matriz](../MATRIZ-ACOES.md), [STATUS](../STATUS.md), `AGENTS.md`, contrato/código na SHA atual, e propor testes antes de alterar runtime. Só implementar após autorização com paths e critério de aceite; atualizar código, documentação, WBS e testes no mesmo incremento.

[Voltar às ações](../MATRIZ-ACOES.md) · [Ficha Mestre](../FICHA-MODULO.md).
