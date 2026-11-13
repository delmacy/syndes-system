---
title: "C04 · WBS e evolução"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# WBS e evolução

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)

> L9: \| Documentação \| Modelo OpenFGA, ports e consumidores mapeados com owner e testes \| Auditoria parcial; revisão formal pendente \|

> L27: 3. **P1 — aplicação dos grants service:** WBS/ADR descrevem candidato tipado, mas o worker continua com gates; não ativar dispatcher, escrever tuples ou aplicar modelo por inferência.

> L36: \| C04.SEC.01 \| PENDENTE \| Snapshot autenticado *read-only* de modelo, stores e política efetiva, sem tuples/PII em docs \|

> L37: \| C04.SEC.02 \| PENDENTE \| Testes adversariais A/B, user/service, grants, revogações e fail-closed no ambiente-alvo \|

> L38: \| C04.OPS.01 \| PENDENTE \| Health, modelo versionado, autorização de migrations/tuples, backup/restore e rollback \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md)

> L15: \| Governança \| `docs/engineering/ADR-EVENTS-OPENFGA-SERVICE-GRANTS-20261111.md`, `WBS-EVENTS-OPENFGA-SERVICE-20261111.md` \| Contratos de implantação/gates, não operação homologada \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/06-wbs-marcos-e-aceite.md)

> L3: \| Marco \| Evidência/aceite \| Estado \|

> L6: \| C04.SEC.01 \| Provar modelo/store e tuples de homologação em leitura segura \| Pendente \|

> L7: \| C04.SEC.02 \| Provar denies A/B, user/service, client, scope, revogação \| Pendente \|

> L8: \| C04.OPS.01 \| Health, observabilidade sem PII, backup/restore e rollback \| Pendente \|

> L11: WBS relacionada: `docs/engineering/WBS-EVENTS-OPENFGA-SERVICE-20261111.md`. Testes in-memory não promovem serviço a DONE nem autorizam ativação do worker.

### [07-controle-do-escopo.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/07-controle-do-escopo.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
