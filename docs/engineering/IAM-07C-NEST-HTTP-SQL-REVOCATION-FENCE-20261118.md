# IAM-07C — HTTP Nest real e proteção SQL da revogação local

**Data:** 2026-11-18. **Estado:** IMPLEMENTADO E TESTADO: PR [#173](https://github.com/delmacy/syndes-system/pull/173) merge `57c722658a4186cc50f2181d3613de2f1bc3153b`, CI [44301444684](https://github.com/delmacy/syndes-system/actions/runs/44301444684) **24/24 jobs aprovados, incluindo `Syndes CI Gate`**. **PRODUCTION_GATE=BLOCKED**.

## Motivação e fronteira

O gate IAM-07B #171 permitiu avançar nas implementações, não habilitar a nova IAM operacional. Havia dois problemas: (a) não existia evidência de uma **requisição HTTP Nest usando o MESMO bearer real Keycloak** que passava pelo índice Control PG17, tenant DB SQL002 e OpenFGA; (b) transferência Inbox e operação de funil Service podiam ler memberships em um snapshot não protegido pelo lock até o COMMIT.

## Implementação

1. `apps/core-host/src/iam07c-http-admission-pilot.ts` oferece **somente** a rota GET `/__ci/iam07c/tenants/:tenantId/inbox/conversations/read`. É compilada, mas **não importada por main.ts, não montada no Host, não tem recurso de negócio ou escrita**. O controller só pode ser instanciado quando as flags de laboratório `CI_MASTER_REAL_PG=1` e `SYNDES_IAM06B_REAL=IAM06B_DISPOSABLE_ONLY` estão presentes. Valida assinatura RS256, issuer, audience, client `azp` e sub com `ActorVerifier.verifyClient`, reconstrói Membership+Module ENABLED+link Control+Keycloak Org live+workspace SQL e finalmente exige OpenFGA read. Responde 401 para bearer ausente/inválido e 403 para admissão ou autorização negadas; retorna apenas `{authorized:true}`.
2. `tests/platform/iam07c-nest-http-ci.mjs` inicia Nest real escutando **apenas loopback**, dentro do laboratório IAM-06B com Keycloak 26.8.1, Control PG17, tenant PG17 e OpenFGA real. Testa user permitido, token Manager/assinatura inválida, usuário de outra Org, tenant/org/workspace divergentes e nega/reabre após revogação de membership SQL, suspensão de módulo, tuple FGA e membership Keycloak **com o mesmo JWT**. Nunca usa PII ou publica dados de cliente.
3. `modules/service-management/src/service.ts`: a consulta de membership agora usa `FOR SHARE OF w,o,om,wm` dentro da transação já pinned que inclui o efeito SQL e auditoria. Isso impede uma revogação **SQL local** de passar silenciosamente enquanto a operação está em execução; o revogador que adquiriu o lock primeiro força a operação subsequente a negar.
4. `modules/inbox/src/postgres.ts`: transferência de workspace mantém `FOR SHARE` nas memberships de origem e destino, e `FOR NO KEY UPDATE` na conversa, na mesma instrução de atualização+auditoria. A atribuição já tinha lock previamente e permanece inalterada.
5. `modules/service-management/test/service-funnels-pg17.test.mjs` e `modules/inbox/test/pg-transfer-revocation-races.mjs`: concorrência real PG17, revogação antes da operação, espera do lock, nenhuma alteração nem auditoria após revogação e sucesso após restabelecimento do vínculo. O teste de transferência cria schema **descartável** separado e suspende apenas nele o índice workspace SQL002 para viabilizar o segundo workspace. **SQL002 operacional e outros esquemas não são alterados.**

## Evidência obtida (laboratório, não produção)

- `IAM07C_REAL_NEST_HTTP_SIGNED_JWT_PG17_FGA_DENY_REVOKE_RESTORE_PASS` — **PASS** no job real Keycloak, além dos marcadores IAM06/07.
- `IAM07C_PG17_SERVICE_MEMBERSHIP_REVOKE_COMMIT_FENCE_PASS` — **PASS** job Service PG17.
- `IAM07C_PG17_INBOX_TRANSFER_DESTINATION_REVOKE_FENCE_PASS` — **PASS** job Inbox PG17.
- `Syndes CI Gate` **PASS**, com **24/24** jobs aprovados na run 44301444684.

## O que NÃO foi comprovado nem habilitado

**CRÍTICO:** a rota é um *probe de autorização HTTP real*, não o controller de negócios da Inbox nem o endpoint operacional. O Service continua opt-in/inativo, não há mudanças de realm, Control, tenant grants, stores OpenFGA ou servidor. O protocolo `FOR SHARE` só fecha a corrida da **revogação registrada no mesmo banco PostgreSQL**. **Não existe transação distribuída** entre Keycloak/OpenFGA e o COMMIT tenant; uma remoção externa pode ocorrer entre o check remoto e o efeito SQL. Não declarar atomicidade externa nem usar esta prova para habilitar fine capabilities `claim/transfer/funnel`. Faltam mecanismo explícito de epoch/fencing de revogação externalizada, grants específicos por ação, integração com controller operacional, role least privilege, replay idempotente e efeito sob falha, SSE multi-host e Product Gate IAM-09 com restore real/rollback.

## Sequência seguinte

- **IAM-07D**: definição verificável de revocation epoch no Control com propagação confiável para o banco tenant e re-check transacional, preservando modelo OpenFGA até Product Gate. Implementar contratos de autorização granular `claim/transfer/funnel`, não mapear os nomes novos para `write` genérico.
- **IAM-09**: E2E controller operacional HTTP com signed JWT real, backup/restore staging, menor privilégio e rollout autorizado. Mantenha `PRODUCTION_GATE=BLOCKED`.

Rastreio: WBS IAM, Issue #160 e PR IAM-07C.
