## 4. Contratos e dependências públicas

HTTP: GET /healthz, GET /readyz e POST /v1/accounts/{tenantUuid}/access/delegations. Exports internos: createAccountAccessServer, createTokenVerifier, fgaObject, createFgaWriteAuthorizer. Helpers privados: bodyObject, credentialFromFile, main. SQL: apply_tenant_account_delegation. Dependências: C01/C03/C04/C05.
