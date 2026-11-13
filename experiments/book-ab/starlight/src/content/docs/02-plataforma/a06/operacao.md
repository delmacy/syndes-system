---
title: "A06 · Operação e implantação"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Operação e implantação

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026**. Código de7b065; testes Node isolados **10/10 aprovados**. **NÃO HOMOLOGADO**: PostgreSQL 17, OpenFGA, Keycloak, OpenBao e deploy reais não verificados.

> L19: \| A06.OPS.01 \| PENDENTE \| Deploy, readiness, rollback \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/REFERENCIA-TECNICA.md)

> L35: apps/account-access-api/test/server.test.mjs e auth.test.mjs passaram 10/10 em /tmp descartável. pg-e2e.mjs e tests/platform/account-roles-pg-smoke.sh não executados. Sem prova de banco, grants, deploy ou eventos de domínio publicados pelo HTTP.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/OPERACAO.md)

> L7: A primeira tentativa npm test falhou por dependência ausente (ERR_MODULE_NOT_FOUND). Após npm ci em /tmp descartável, os 10 testes Node passaram. Isso não valida banco ou implantação.

> L13: 3. Validar readiness, ingress, logs, backup, rollback e CI por SHA.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/chapters/06-wbs-marcos-e-aceite.md)

> L8: \| A06.OPS.01 \| Pendente \| Deploy, readiness, rollback \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A06-account-access-api/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
