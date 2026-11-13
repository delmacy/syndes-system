# A06 — Account Access API: auditoria de contratos e teste isolado

> **13/11/2026, baseline `56ebeeb`, auditoria parcial de código.** Nenhum ambiente real, grant, usuário, banco ou cofre alterado. `origin/main` observado em `75d99e087896531013241b4e45c3318bab2e71b1`; divergência de histórico local/remote ainda exige integração documental cuidadosa. Não promover A06 a homologado.

## Contratos de entrada e consumidores

- `apps/account-access-api/src/server.mjs`: `createAccountAccessServer` expõe somente `GET /healthz`, `GET /readyz` e `POST /v1/accounts/{tenantId}/access/delegations`. Verifica tenant UUID, origem HTTPS exata, `Idempotency-Key` UUID, corpo JSON estrito (até 2048 bytes, chaves `operation,principalId,role`), Bearer, FGA e delegação SQL nesta ordem. Sanitiza falhas. Sem UI, CRM, Inbox ou proxy.
- `src/auth.mjs`: `createTokenVerifier` usa JWKS, RS256, issuer, audience, `azp` dedicado e `sub`; `createFgaWriteAuthorizer` exige `can_write` sobre `resource:sha256(tenantId|account:roles)`. `fgaObject` é export de domínio técnico, não grant automático.
- `src/main.mjs`: `credentialFromFile` exige login SQL `syndes_account_api` em `syndes_control` por arquivo sob `/run/secrets/`; readiness procura `apply_tenant_account_delegation`; chamada SQL parametrizada, sem DML direto em tabelas de grants.

## SQL e privilégios reais no código

- `infra/postgres/bootstrap/control-account-roles.schema` (DC-2a) define grants e auditoria de papéis por tenant, com membership e last-owner gates.
- `infra/postgres/bootstrap/control-account-delegation.schema` (DC-2b) define papel `syndes_account_delegate` NOLOGIN, revoga acesso direto a tabelas, concede apenas `EXECUTE` em `apply_tenant_account_delegation` via `SECURITY DEFINER`, com `search_path` fixo. A função revalida tenant ativo, ator owner ativo, membership do alvo, idempotência por `(tenant_id,request_id)`, trava por tenant e proteção contra último owner. Gatilhos adicionais bloqueiam mutação da auditoria e revogação de membership do último owner.
- O login `syndes_account_api` **não é criado pelo schema**. A associação ao papel NOLOGIN é etapa operacional aprovada, simulada em `apps/account-access-api/test/pg-e2e.mjs`; não afirmar provisionamento em produção.
- `docs/engineering/ACCOUNT-ACCESS-FOUNDATION.md` declara explicitamente não implantado, e separa a matriz de capabilities **proposta** da API efetivamente implementada.

## Testes executados, sem efeitos em banco

- Primeira tentativa `npm test` na worktree falhou com `ERR_MODULE_NOT_FOUND` por dependências ausentes; não é evidência de falha funcional.
- `npm ci --offline` em diretório descartável `/tmp/syndes-a06-test-20261113` falhou porque tarball `jose@6.0.11` não estava em cache. Repetição `npm ci --ignore-scripts --no-audit --no-fund` com registry disponível **passou**, 15 packages instalados no diretório descartável, sem modificar o checkout.
- Copiados `src/` e `test/` para esse diretório descartável e executado `npm test`: **10/10 testes passaram** (JWKS RS256, FGA, negativas de HTTP, idempotência mockada, tratamento de erros). Nenhum teste PG, container, CI remoto ou serviço real foi executado nesta auditoria.
- Próximo gate de integração: PostgreSQL 17 descartável e `tests/platform/account-roles-pg-smoke.sh`, com autorização de uso de Docker e checagem de nomes/portas para evitar conflito. Não executar scripts em banco persistente.

## Riscos e ações para a próxima tarefa

1. Confirmar com testes PG descartáveis os privilégios de `syndes_account_delegate`, tenant A/B, last-owner e reexecução de migrations; não inferir do SQL estático.
2. Auditar `apps/account-access-api/test/pg-e2e.mjs` e CI `scripts/ci/run-account-access.sh` antes de executar: o script de CI usa nomes de containers fixos e arquivos `/run/secrets/ci-*` e pode conflitar com outros processos. Preferir isolamento próprio.
3. Conferir as dependências OIDC Keycloak, OpenFGA e OpenBao **implantadas** por ambiente sem consultar segredos. A API não está homologada pelo simples fato de testes unitários verdes.
4. Próxima frente de documentação deve reconciliar os oito capítulos A06 e contratos testemunhados, sem atribuir `syndes_account_api` ao papel já provisionado.
5. Verificar integração com `origin/main` e Pages por SHA publicado; HTTP 200 isolado não comprova atualização.

**Proveniência:** todos os caminhos acima foram inspecionados em checkout Git local. A única mutação foi instalação de dependências e execução de testes em `/tmp`, além deste checkpoint documental.
