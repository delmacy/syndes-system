# A06 — Account Access API | Referência técnica

> Auditoria estática de código de7b065; testes Node 10/10 em ambiente descartável, sem integração real.

## Stack e fronteiras

Node ESM >=22, jose 6.0.11, pg 8.16.3. Serviço backend de delegação owner/admin, sem frontend, CRM, Inbox ou proxy genérico. C01 é owner do Control, C03 da identidade, C04 da autorização, C05 dos segredos.

## HTTP

- GET /healthz: liveness 200 sem dependências.
- GET /readyz: 200/503, verifica presença da função SQL.
- POST /v1/accounts/{tenantUuid}/access/delegations: exige Origin HTTPS exata, Bearer, Idempotency-Key UUID, Content-Type JSON, body até 2048 bytes com operation grant/revoke, principalId e role owner/admin; retorna role, state, alreadyApplied. Respostas de erro sanitizadas.

## Símbolos e contratos

| Símbolo | Fonte | Responsabilidade |
|---|---|---|
| createAccountAccessServer | src/server.mjs | Factory HTTP exportada, injeta verificador, autorização e delegação |
| createTokenVerifier | src/auth.mjs | Export JWKS RS256, issuer, audience, azp, subject |
| fgaObject | src/auth.mjs | Export resource:sha256(tenantId e resource) |
| createFgaWriteAuthorizer | src/auth.mjs | Export can_write tenant-scoped, timeout 3s |
| bodyObject | src/server.mjs | Parser privado de JSON |
| credentialFromFile | src/main.mjs | Helper privado, Control URL em /run/secrets e role syndes_account_api |
| main | src/main.mjs | Entrypoint privado, pool PG, OIDC, FGA e HTTP loopback |

Exports são internos ao pacote Node, não SDK externo.

## SQL e segurança

infra/postgres/bootstrap/control-account-roles.schema e control-account-delegation.schema contêm apply_tenant_account_delegation com SECURITY DEFINER, search_path fixo, tenant ativo, owner ativo, membership do alvo, idempotência, lock e proteção do último owner. Papel syndes_account_delegate NOLOGIN com EXECUTE limitado, sem DML direto. Login syndes_account_api exige provisionamento separado, não comprovado.

## Testes e operação

apps/account-access-api/test/server.test.mjs e auth.test.mjs passaram 10/10 em /tmp descartável. pg-e2e.mjs e tests/platform/account-roles-pg-smoke.sh não executados. Sem prova de banco, grants, deploy ou eventos de domínio publicados pelo HTTP.

[Status](STATUS.md) · [Operação](OPERACAO.md).
