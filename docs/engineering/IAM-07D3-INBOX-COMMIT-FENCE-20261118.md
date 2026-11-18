# IAM-07D3 — Inbox real dentro da transação IAM com epoch

**Data:** 2026-11-18. **Estado:** candidato até CI. **PRODUCTION_GATE=BLOCKED**.

## Contrato de execução

`apps/core-host/src/iam07d-inbox-business-pilot.ts` liga `Iam07dRevokeFirstPilot.issue/execute` ao **PgInboxRepository existente**. Não redefine o domínio de Inbox ou cria segunda engine. A admissão usa o JWT Keycloak verificado, Keycloak Organizations live, Control PG17, ModuleAccess, contexto SQL002 e `OpenFgaFineCapabilityPolicy` exata. `execute` refaz a admissão e política e mantém o `SELECT ... FOR SHARE` da capability e memberships até o COMMIT.

A operação `claim` exige `inbox.conversation.claim`, seleciona dentro da transação a conversa do mesmo tenant/org/ws **ainda não atribuída** com `FOR NO KEY UPDATE`, e chama `PgInboxRepository.assign` **usando o mesmo objeto `tx`**. Alteração e evento `inbox_events.assigned` são incluídos no commit; segunda reivindicação não vira transferência disfarçada. A operação `transfer` exige outra capability `inbox.conversation.transfer`, valida IDs e utiliza `PgInboxRepository.transferWorkspace`, com os locks de destino/origem da etapa IAM-07C, dentro do mesmo `tx`.

## Teste real e fronteiras

`tests/platform/iam07d2-fine-fga-live-ci.mjs` passa a instalar no tenant **descartável** as migrations oficiais de CRM, Inbox, WhatsApp e ownership, sem tocar no servidor; insere duas conversas simuladas e exercita a claim real com o mesmo token humano Keycloak e store candidato OpenFGA. Confirma uma atribuição + auditoria, tentativa duplicada negada, transferência sem grant específico negada; após remoção direta do FGA, claim nova negada; após revogar primeiro o epoch no tenant, a claim continua negada **mesmo enquanto a tuple FGA ainda é ALLOW**, e nenhuma auditoria é produzida.

**Marcador adicional esperado:** `IAM07D3_REAL_KEYCLOAK_FGA_PG17_INBOX_CLAIM_EPOCH_AUDIT_PASS`, além dos marcadores IAM07D2 e `Syndes CI Gate`.

**Limites relevantes:** a rota Nest de negócios operacional não está montada neste piloto; `main.ts` permanece sem import. Não se provou transferência bem-sucedida cross-workspace sob IAM específico, porque SQL002 bloqueia fisicamente um segundo workspace; o teste da transferência sob autorização SQL local da etapa IAM-07C continua válido em schema descartável com segundo workspace. O módulo Service Management ainda carece de ligação **real** do fence ao mesmo `TenantTransaction` de `advance/assign/transferTeam` e de validação de `funnelId` dentro dele. Não tratar callback sintético como autorização de produto.

A janela de revogação externa direta **após a última revalidação e antes do COMMIT** permanece; a garantia robusta depende de impedir escritores administrativos externos de contornar o tenant-first e garantir que **todos** os caminhos de negócio usem o fence. Reconciliar concessões FGA fora do catálogo é indispensável. **IAM-09 PRODUCTION_GATE=BLOCKED** até tais invariantes, least privilege, rollout controlado, testes de carga, restore staging real e aceite.

Próxima ação: integração Service/funnel, transferência multi-workspace em configuração suportada, API administrativa com segregação de funções e deploy por CI/CD apenas após Product Gate.
