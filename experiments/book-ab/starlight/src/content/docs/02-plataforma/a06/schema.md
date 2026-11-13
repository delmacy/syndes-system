---
title: "A06 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)

> L9: - SQL: control-account-roles.schema e control-account-delegation.schema definem apply_tenant_account_delegation e proteção de último owner. Inspeção estática, sem PG17.

> L10: - Startup: exige login syndes_account_api, não criado automaticamente pela migration.

> L17: \| A06.SQL.01 \| PENDENTE \| PG17 descartável, A/B, idempotência, último owner \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/REFERENCIA-TECNICA.md)

> L12: - GET /readyz: 200/503, verifica presença da função SQL.

> L31: infra/postgres/bootstrap/control-account-roles.schema e control-account-delegation.schema contêm apply_tenant_account_delegation com SECURITY DEFINER, search_path fixo, tenant ativo, owner ativo, membership do alvo, idempotência, lock e proteção do último owner. Papel syndes_account_delegate NOLOGIN com EXECUTE limitado, sem DML direto. Login syndes_account_api exige provisionamento separado, não comprovado.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/OPERACAO.md)

> L3: > Checklist de auditoria, não runbook homologado. Nenhuma migration, role, segredo ou serviço foi alterado.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/04-contratos-e-dependencias-publicas.md)

> L3: HTTP: GET /healthz, GET /readyz e POST /v1/accounts/{tenantUuid}/access/delegations. Exports internos: createAccountAccessServer, createTokenVerifier, fgaObject, createFgaWriteAuthorizer. Helpers privados: bodyObject, credentialFromFile, main. SQL: apply_tenant_account_delegation. Dependências: C01/C03/C04/C05.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L3: Fluxo: HTTP POST -> JWT RS256 -> OpenFGA can_write -> SQL Control SECURITY DEFINER -> resposta sanitizada. Persistência Control, não Tenant DB. Segredos via /run/secrets; rede loopback por padrão; frontend próprio inexistente. Nenhum evento de negócio publicado pela API HTTP foi identificado.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
