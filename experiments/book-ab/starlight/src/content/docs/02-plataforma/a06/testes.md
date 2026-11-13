---
title: "A06 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026**. Código de7b065; testes Node isolados **10/10 aprovados**. **NÃO HOMOLOGADO**: PostgreSQL 17, OpenFGA, Keycloak, OpenBao e deploy reais não verificados.

> L7: - HTTP: createAccountAccessServer oferece GET /healthz, GET /readyz e POST /v1/accounts/{tenantUuid}/access/delegations; oito testes mockados passaram.

> L8: - Auth: createTokenVerifier usa RS256/JWKS, issuer/audience/azp dedicado; createFgaWriteAuthorizer exige can_write em recurso tenant-scoped; dois testes passaram.

> L14: \| ID \| Estado \| Gate \|

> L16: \| A06.DOC.01 \| AUDITORIA PARCIAL \| Contratos e evidências vinculados \|

> L20: \| A06.GATE \| BLOQUEADO \| Aceite C01/C03/C04/C05/A06 \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/REFERENCIA-TECNICA.md)

> L3: > Auditoria estática de código de7b065; testes Node 10/10 em ambiente descartável, sem integração real.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/OPERACAO.md)

> L7: A primeira tentativa npm test falhou por dependência ausente (ERR_MODULE_NOT_FOUND). Após npm ci em /tmp descartável, os 10 testes Node passaram. Isso não valida banco ou implantação.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/06-wbs-marcos-e-aceite.md)

> L5: \| A06.DOC.01 \| Auditoria parcial \| Contratos e evidências \|

> L9: \| A06.GATE \| Bloqueado \| Sign-off por SHA \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
