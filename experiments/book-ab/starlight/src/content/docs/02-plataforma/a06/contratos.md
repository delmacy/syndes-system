---
title: "A06 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)

> L16: \| A06.DOC.01 \| AUDITORIA PARCIAL \| Contratos e evidências vinculados \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/REFERENCIA-TECNICA.md)

> L20: \| createTokenVerifier \| src/auth.mjs \| Export JWKS RS256, issuer, audience, azp, subject \|

> L21: \| fgaObject \| src/auth.mjs \| Export resource:sha256(tenantId e resource) \|

> L22: \| createFgaWriteAuthorizer \| src/auth.mjs \| Export can_write tenant-scoped, timeout 3s \|

> L23: \| bodyObject \| src/server.mjs \| Parser privado de JSON \|

> L24: \| credentialFromFile \| src/main.mjs \| Helper privado, Control URL em /run/secrets e role syndes_account_api \|

> L25: \| main \| src/main.mjs \| Entrypoint privado, pool PG, OIDC, FGA e HTTP loopback \|

> L27: Exports são internos ao pacote Node, não SDK externo.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/04-contratos-e-dependencias-publicas.md)

> L3: HTTP: GET /healthz, GET /readyz e POST /v1/accounts/{tenantUuid}/access/delegations. Exports internos: createAccountAccessServer, createTokenVerifier, fgaObject, createFgaWriteAuthorizer. Helpers privados: bodyObject, credentialFromFile, main. SQL: apply_tenant_account_delegation. Dependências: C01/C03/C04/C05.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
