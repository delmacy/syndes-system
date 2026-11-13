# A06 — Account Access API: checkpoint de auditoria inicial

> **Inventário parcial somente leitura, 13/11/2026; base Git local `ef989b1`.** Não altera o STATUS de A06 para auditado. Não é validação de deploy, CI remoto, banco ou autorização real.

## Fontes observadas

- `apps/account-access-api/package.json`: Node ESM privado, `jose` 6.0.11 e `pg` 8.16.3, entrypoint `src/main.mjs`.
- `src/auth.mjs`: exports `createTokenVerifier`, `fgaObject`, `createFgaWriteAuthorizer`. RS256, issuer, audience, azp exato e rejeição de cliente Master. OpenFGA `can_write` para objeto `account:roles` vinculado ao tenant.
- `src/server.mjs`: export `createAccountAccessServer`; somente `POST /v1/accounts/{tenantUuid}/access/delegations`, mais `GET /healthz` e `GET /readyz`. POST exige Origin permitido, `Content-Type`, UUID idempotente, Bearer verificado, payload exato e decisão FGA; chama delegação SQL no Control e devolve resposta sanitizada.
- `src/main.mjs`: lê conexão do Control por arquivo sob `/run/secrets/`, role SQL dedicada `syndes_account_api`, endpoint/store/token FGA, config OIDC separada; função `apply_tenant_account_delegation` é consultada em `pg_proc` durante readiness e invocada na mutação.
- `test/server.test.mjs`, `test/auth.test.mjs`, `test/pg-e2e.mjs`: suites de negativa, JWKS/FGA e integração PG descartável. O teste PG não foi executado e não deve ser disparado em banco real.

## Resultado local de testes

Executado `cd apps/account-access-api && npm test` na worktree documental **sem dependências instaladas**: `8 pass / 1 fail` (falha ao carregar `test/auth.test.mjs`, `ERR_MODULE_NOT_FOUND`, dependência Node ausente). **Não atribuir essa falha ao comportamento do produto**. Preparar ambiente Node de teste isolado e repetir antes de declarar suíte verde. Testes de UI/PG/FGA real não executados neste checkpoint.

## Continuidade para a próxima execução

1. Reconciliar remoto `main` (`75d99e0` observado em 13/11) com commits documentais locais acumulados sem sobrescrever alterações de outros agentes.
2. Conferir a implementação da rotina SQL `apply_tenant_account_delegation`, grants, migrations do Control e testes cross-tenant; registrar localização e provas negativas.
3. Preparar Node dependencies no ambiente isolado apropriado e rodar `npm test`, sem misturar binários de worktrees nem consultar segredos.
4. Atualizar oito capítulos, STATUS, REFERENCIA-TECNICA, OPERACAO, plano e `contract-witnesses.json` de A06 **somente quando** essas evidências estiverem reconciliadas, mantendo contrato público separado do privado.
5. Publicação em GitHub Pages exige push/CI e revisão do site, não basta HTTP 200. Último site observado HTTP 200 sem validação de SHA publicado.

**Segurança:** não criar grants, usuários, tenants ou migrations, não registrar secrets, não fazer deploy como parte desta auditoria.
