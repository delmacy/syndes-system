# IAM-07D3 — Inbox real dentro da transação IAM com epoch

**Data:** 2026-11-18. **Estado:** MERGED PR [#178](https://github.com/delmacy/syndes-system/pull/178), CI [44312054884](https://github.com/delmacy/syndes-system/actions/runs/44312054884) **24/24**. **PRODUCTION_GATE=BLOCKED**.

## Contrato de execução

`apps/core-host/src/iam07d-inbox-business-pilot.ts` liga `Iam07dRevokeFirstPilot.issue/execute` ao **PgInboxRepository existente**. Não redefine o domínio de Inbox ou cria segunda engine. A admissão usa o JWT Keycloak verificado, Keycloak Organizations live, Control PG17, ModuleAccess, contexto SQL002 e `OpenFgaFineCapabilityPolicy` exata. `execute` refaz a admissão e política e mantém o `SELECT ... FOR SHARE` da capability e memberships até o COMMIT.

A operação `claim` exige `inbox.conversation.claim`, seleciona dentro da transação a conversa do mesmo tenant/org/ws **ainda não atribuída** com `FOR NO KEY UPDATE`, e chama `PgInboxRepository.assign` **usando o mesmo objeto `tx`**. Alteração e evento `inbox_events.assigned` são incluídos no commit; segunda reivindicação não vira transferência disfarçada. A operação `transfer` exige outra capability `inbox.conversation.transfer`, valida IDs e utiliza `PgInboxRepository.transferWorkspace`, com os locks de destino/origem da etapa IAM-07C, dentro do mesmo `tx`.

## Teste real e fronteiras

`tests/platform/iam07d2-fine-fga-live-ci.mjs` passa a instalar no tenant **descartável** as migrations oficiais de CRM, Inbox, WhatsApp e ownership, sem tocar no servidor; insere duas conversas simuladas e exercita a claim real com o mesmo token humano Keycloak e store candidato OpenFGA. Confirma uma atribuição + auditoria, tentativa duplicada negada, transferência sem grant específico negada; após remoção direta do FGA, claim nova negada; após revogar primeiro o epoch no tenant, a claim continua negada **mesmo enquanto a tuple FGA ainda é ALLOW**, e nenhuma auditoria é produzida.

**Prova adicional de transferência, em PostgreSQL real isolado:** o teste `modules/inbox/test/pg-transfer-revocation-races.mjs` aplica a migration candidata 008 enquanto SQL002 ainda existe, e remove o índice de workspace **apenas no schema descartável**. Cria um ator UUID com membership ativa em origem e destino, exige `inbox.conversation.transfer` de uma política específica, executa `Iam07dInboxBusinessPilot.transfer` em transação pinned, audita uma transferência e, depois de revogar o epoch, nega uma segunda sem auditoria. Marcador: `IAM07D3_PG17_REAL_TRANSFER_EPOCH_AUDIT_PASS`. A autenticação nesse teste é um **stub controlado**; JWT humano real permanece comprovado no teste de claim.

**Marcador adicional esperado:** `IAM07D3_REAL_KEYCLOAK_FGA_PG17_INBOX_CLAIM_EPOCH_AUDIT_PASS`, além dos marcadores IAM07D2 e `Syndes CI Gate`.

**Limites relevantes:** a rota Nest de negócios operacional não está montada neste piloto; `main.ts` permanece sem import. A transferência cross-workspace **sob epoch IAM** é exercitada em um **schema PostgreSQL 17 isolado com duas workspaces**, mas usa um **adapter de identidade/política fina injetado pelo teste**; não é a mesma prova HTTP com JWT real do laboratório IAM-07D3 claim, nem libera SQL002 físico em qualquer tenant operacional. O avanço de etapa do Service Management passou a ter ligação **real** do fence ao mesmo `TenantTransaction` via IAM-07D4 #179, com `funnelId` validado e teste PG17 real. **Outras** operações (`assign`, `transferTeam`, `open`, `close`) ainda não estão vinculadas ao fence. Não tratar callback sintético como autorização de produto.

A janela de revogação externa direta **após a última revalidação e antes do COMMIT** permanece; a garantia robusta depende de impedir escritores administrativos externos de contornar o tenant-first e garantir que **todos** os caminhos de negócio usem o fence. Reconciliar concessões FGA fora do catálogo é indispensável. **IAM-09 PRODUCTION_GATE=BLOCKED** até tais invariantes, least privilege, rollout controlado, testes de carga, restore staging real e aceite.

Próxima ação: integração Service/funnel, transferência multi-workspace em configuração suportada, API administrativa com segregação de funções e deploy por CI/CD apenas após Product Gate.
