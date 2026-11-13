# A06 — Account Access API | Operação

> Checklist de auditoria, não runbook homologado. Nenhuma migration, role, segredo ou serviço foi alterado.

## Testes

A primeira tentativa npm test falhou por dependência ausente (ERR_MODULE_NOT_FOUND). Após npm ci em /tmp descartável, os 10 testes Node passaram. Isso não valida banco ou implantação.

## Gates pendentes

1. PostgreSQL 17 descartável: grants, EXECUTE, tenant A/B, último owner, idempotência e replay.
2. Validar role syndes_account_api, JWT/JWKS, OpenFGA e secrets em ambiente autorizado sem ler valores.
3. Validar readiness, ingress, logs, backup, rollback e CI por SHA.
4. Sign-off C01/C03/C04/C05/A06 e segurança.

[STATUS](STATUS.md) · [SPRINT](SPRINT.md) · [Evolução](EVOLUCAO.md) · [Histórico](HISTORICO.md) · [Projeção](PROJECAO.md) · [Implementação](IMPLEMENTACAO.md) · [Alteração](ALTERACAO.md).
