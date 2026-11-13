# A06 — Account Access API | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026**. Código de7b065; testes Node isolados **10/10 aprovados**. **NÃO HOMOLOGADO**: PostgreSQL 17, OpenFGA, Keycloak, OpenBao e deploy reais não verificados.

## Evidências

- HTTP: createAccountAccessServer oferece GET /healthz, GET /readyz e POST /v1/accounts/{tenantUuid}/access/delegations; oito testes mockados passaram.
- Auth: createTokenVerifier usa RS256/JWKS, issuer/audience/azp dedicado; createFgaWriteAuthorizer exige can_write em recurso tenant-scoped; dois testes passaram.
- SQL: control-account-roles.schema e control-account-delegation.schema definem apply_tenant_account_delegation e proteção de último owner. Inspeção estática, sem PG17.
- Startup: exige login syndes_account_api, não criado automaticamente pela migration.

## WBS

| ID | Estado | Gate |
|---|---|---|
| A06.DOC.01 | AUDITORIA PARCIAL | Contratos e evidências vinculados |
| A06.SQL.01 | PENDENTE | PG17 descartável, A/B, idempotência, último owner |
| A06.SEC.01 | PENDENTE | JWKS/FGA/segredos reais |
| A06.OPS.01 | PENDENTE | Deploy, readiness, rollback |
| A06.GATE | BLOQUEADO | Aceite C01/C03/C04/C05/A06 |

Próxima unidade: A04 — Core Host.

[Referência](REFERENCIA-TECNICA.md) · [Operação](OPERACAO.md).
