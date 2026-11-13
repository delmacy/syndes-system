---
title: "A06 · Dependências e integrações"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dependências e integrações

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026**. Código de7b065; testes Node isolados **10/10 aprovados**. **NÃO HOMOLOGADO**: PostgreSQL 17, OpenFGA, Keycloak, OpenBao e deploy reais não verificados.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/REFERENCIA-TECNICA.md)

> L3: > Auditoria estática de código de7b065; testes Node 10/10 em ambiente descartável, sem integração real.

> L11: - GET /healthz: liveness 200 sem dependências.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/OPERACAO.md)

> L7: A primeira tentativa npm test falhou por dependência ausente (ERR_MODULE_NOT_FOUND). Após npm ci em /tmp descartável, os 10 testes Node passaram. Isso não valida banco ou implantação.

> L12: 2. Validar role syndes_account_api, JWT/JWKS, OpenFGA e secrets em ambiente autorizado sem ler valores.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/04-contratos-e-dependencias-publicas.md)

> L3: HTTP: GET /healthz, GET /readyz e POST /v1/accounts/{tenantUuid}/access/delegations. Exports internos: createAccountAccessServer, createTokenVerifier, fgaObject, createFgaWriteAuthorizer. Helpers privados: bodyObject, credentialFromFile, main. SQL: apply_tenant_account_delegation. Dependências: C01/C03/C04/C05.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L3: Fluxo: HTTP POST -> JWT RS256 -> OpenFGA can_write -> SQL Control SECURITY DEFINER -> resposta sanitizada. Persistência Control, não Tenant DB. Segredos via /run/secrets; rede loopback por padrão; frontend próprio inexistente. Nenhum evento de negócio publicado pela API HTTP foi identificado.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
