---
title: "A04 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)

> L12: \| Lifecycle \| `PgModuleCatalog`, `PgModuleLifecycle`, `PgEffectiveModuleAccess`, `PgModuleInstaller` \| Plano, instalação, ativação e execução são gates diferentes \|

> L14: \| Testes \| Testes existentes e checkpoint estático \| Suite Node A04 não reexecutada neste incremento; dependências isoladas pendentes \|

> L22: \| A04.TEST.01 \| PENDENTE \| Instalar dependências pinadas em cópia descartável, compilar e executar testes A04 com relatório por SHA \|

> L24: \| A04.SEC.01 \| PENDENTE \| JWT, FGA, OpenBao, gates de módulo e fail-closed em ambiente autorizado \|

> L26: \| A04.GATE \| BLOQUEADO \| Owner review, CI por SHA, operação comprovada e publicação documental \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/REFERENCIA-TECNICA.md)

> L23: \| `src/module-effective-access.ts` \| `PgEffectiveModuleAccess.canExecuteModule` \| Gate de execução efetiva \|

> L30: \| Método \| Rota no Core Host \| Gate \|

> L59: Fonte: `docs/evidence/checkpoints/A04-core-host-initial-20261113-0900.md` no branch de auditoria `docs/a04-code-audit-20261113` (não necessariamente incorporado nesta worktree). O checkpoint reportou validação lexical/catálogo e testes A04 **não executados** por ausência de dependências locais; não converter resultado histórico de outro SHA em teste desta revisão. Testes PG17/FGA e deploy real pendentes.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/OPERACAO.md)

> L8: 2. Inventariar controllers e contratos HTTP/SSE de cada plugin. Conferir ordem de JWT → membership → FGA → gates Control; documentar negativas cross-tenant e org/workspace.

> L9: 3. Em PostgreSQL 17 **segregado**, confrontar migrations Control/Tenant, roles/grants e `TenantPgProvider` com testes de isolamento, sem usar dados reais.

> L11: 5. Somente com aprovação operacional, planejar testes de Event Platform: publisher, dispatcher, worker admission, idempotência, replay e DLQ. Não iniciar serviços a partir de documentação.

> L12: 6. Registrar evidência sanitizada por SHA/ambiente, owner review, CI e rollback antes de promover status.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/06-wbs-marcos-e-aceite.md)

> L10: \| A04.GATE \| Bloqueado \| CI, owners, ambiente e documentação publicada \|

> L12: A conclusão da WBS documental não habilita novas features nem substitui o Product Gate.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
