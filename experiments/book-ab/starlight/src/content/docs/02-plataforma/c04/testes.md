---
title: "C04 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)

> L7: \| Dimensão \| Evidência \| Limite \|

> L9: \| Documentação \| Modelo OpenFGA, ports e consumidores mapeados com owner e testes \| Auditoria parcial; revisão formal pendente \|

> L11: \| Integração sintética \| Testes de adapters, escopo e suíte in-memory OpenFGA versionada \| Não equivale a acesso real do tenant/operador \|

> L21: - **C01/Organizations:** tenant membership, estado da organização e módulos ENABLED são gates distintos de decisão FGA.

> L26: 2. **P0 — isolamento de tenant não homologado:** testar matrizes de user/service, tenant A/B, org/workspace e negações em ambiente autorizado; testes descartáveis não provam produção.

> L27: 3. **P1 — aplicação dos grants service:** WBS/ADR descrevem candidato tipado, mas o worker continua com gates; não ativar dispatcher, escrever tuples ou aplicar modelo por inferência.

> L35: \| C04.DOC.01 \| **AUDITORIA PARCIAL** \| Contratos e fontes reconciliados, evidências source-linked \|

> L37: \| C04.SEC.02 \| PENDENTE \| Testes adversariais A/B, user/service, grants, revogações e fail-closed no ambiente-alvo \|

> L39: \| C04.GATE \| BLOQUEADO \| Aceite integrado com C01/C03/A04/A06/C06 e owners \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md)

> L15: \| Governança \| `docs/engineering/ADR-EVENTS-OPENFGA-SERVICE-GRANTS-20261111.md`, `WBS-EVENTS-OPENFGA-SERVICE-20261111.md` \| Contratos de implantação/gates, não operação homologada \|

> L65: - Testes: `apps/core-host/test/adapters.test.mjs`, `platform-event-service-grant.test.mjs`, `platform-event-service-grant-fga.test.mjs`, `apps/account-access-api/test/auth.test.mjs`. Incluem negativas e instância in-memory/descartável, não configuração runtime persistente.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/OPERACAO.md)

> L11: 5. Exigir sign-off de C01/C03/C04/A04/A06/C06, testes CI e testes HTTP/PG17/OpenFGA no ambiente-alvo por SHA antes de registrar Product Gate.

> L17: - Não concluir implantação/segurança pela imagem Docker em execução ou pelos testes sintéticos.

> L23: Modelo: `infra/security-access/fga-model.json`. Testes: `apps/core-host/test/adapters.test.mjs`, `platform-event-service-grant.test.mjs`, `platform-event-service-grant-fga.test.mjs`.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/06-wbs-marcos-e-aceite.md)

> L3: \| Marco \| Evidência/aceite \| Estado \|

> L5: \| C04.DOC.01 \| Modelo, wrappers, testes, fronteiras e witness registry \| **Auditoria parcial** \|

> L9: \| C04.GATE \| Owner/security sign-off com modelos/tuples revisados e CI por SHA \| Bloqueado \|

> L11: WBS relacionada: `docs/engineering/WBS-EVENTS-OPENFGA-SERVICE-20261111.md`. Testes in-memory não promovem serviço a DONE nem autorizam ativação do worker.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
