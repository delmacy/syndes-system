# A04 — Core Host | Operação

> **CHECKLIST DE AUDITORIA, NÃO RUNBOOK DE PRODUÇÃO.** Nenhum deploy, worker, migration, alteração de grant ou consulta de secrets foi realizado neste incremento.

## Preparação e testes futuros

1. Confirmar SHA de código, lockfile, owners e ausência de edição concorrente. Preparar cópia **descartável** com dependências Node pinadas; rodar `npm run check` e suites A04, separando SKIP, PASS e falhas reais.
2. Inventariar controllers e contratos HTTP/SSE de cada plugin. Conferir ordem de JWT → membership → FGA → gates Control; documentar negativas cross-tenant e org/workspace.
3. Em PostgreSQL 17 **segregado**, confrontar migrations Control/Tenant, roles/grants e `TenantPgProvider` com testes de isolamento, sem usar dados reais.
4. Em ambiente autorizado, validar readiness, TLS, OpenBao, OpenFGA, revogação, entitlements e comportamento em indisponibilidade; não usar resultado sintético como homologação.
5. Somente com aprovação operacional, planejar testes de Event Platform: publisher, dispatcher, worker admission, idempotência, replay e DLQ. Não iniciar serviços a partir de documentação.
6. Registrar evidência sanitizada por SHA/ambiente, owner review, CI e rollback antes de promover status.

## Limites e navegação

[STATUS](STATUS.md) · [SPRINT](SPRINT.md) · [Evolução](EVOLUCAO.md) · [Projeção](PROJECAO.md) · [Implementação](IMPLEMENTACAO.md) · [Alteração](ALTERACAO.md) · [Referência técnica](REFERENCIA-TECNICA.md).

Não registrar tokens, strings de conexão, identidades privadas, grants ou informações sensíveis em Git.
