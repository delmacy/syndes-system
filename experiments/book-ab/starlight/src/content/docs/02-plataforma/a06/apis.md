---
title: "A06 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)

> L7: - HTTP: createAccountAccessServer oferece GET /healthz, GET /readyz e POST /v1/accounts/{tenantUuid}/access/delegations; oito testes mockados passaram.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/REFERENCIA-TECNICA.md)

> L11: - GET /healthz: liveness 200 sem dependências.

> L12: - GET /readyz: 200/503, verifica presença da função SQL.

> L13: - POST /v1/accounts/{tenantUuid}/access/delegations: exige Origin HTTPS exata, Bearer, Idempotency-Key UUID, Content-Type JSON, body até 2048 bytes com operation grant/revoke, principalId e role owner/admin; retorna role, state, alreadyApplied. Respostas de erro sanitizadas.

> L19: \| createAccountAccessServer \| src/server.mjs \| Factory HTTP exportada, injeta verificador, autorização e delegação \|

> L25: \| main \| src/main.mjs \| Entrypoint privado, pool PG, OIDC, FGA e HTTP loopback \|

> L35: apps/account-access-api/test/server.test.mjs e auth.test.mjs passaram 10/10 em /tmp descartável. pg-e2e.mjs e tests/platform/account-roles-pg-smoke.sh não executados. Sem prova de banco, grants, deploy ou eventos de domínio publicados pelo HTTP.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/04-contratos-e-dependencias-publicas.md)

> L3: HTTP: GET /healthz, GET /readyz e POST /v1/accounts/{tenantUuid}/access/delegations. Exports internos: createAccountAccessServer, createTokenVerifier, fgaObject, createFgaWriteAuthorizer. Helpers privados: bodyObject, credentialFromFile, main. SQL: apply_tenant_account_delegation. Dependências: C01/C03/C04/C05.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L3: Fluxo: HTTP POST -> JWT RS256 -> OpenFGA can_write -> SQL Control SECURITY DEFINER -> resposta sanitizada. Persistência Control, não Tenant DB. Segredos via /run/secrets; rede loopback por padrão; frontend próprio inexistente. Nenhum evento de negócio publicado pela API HTTP foi identificado.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
