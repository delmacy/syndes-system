---
title: "Q01 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)

> L7: \| Dimensão \| Evidência comprovada \| Limites e gates \|

> L10: \| **Implementação** \| Scripts reais em `tests/platform` e `tests/integrity`, AGENTS em integration/security/performance; testes também em modules/apps \| Sem backend/API/schema/frontend exclusivo de Q01; nem todo AGENTS tem runner \|

> L13: \| **Testes de performance** \| Diretrizes `tests/performance/AGENTS.md` e Test Strategy \| Stress/spike/soak e resultados p50/p95/p99 **não verificados** \|

> L15: \| **Produto/Go-live** \| Não há Product Gate atribuído à Q01 \| MVP não homologado por esta auditoria; aceite pertence aos owners \|

> L19: \| Grupo \| Script/fonte identificado \| Evidência exigida além de presença \|

> L25: \| Diretrizes de integração/segurança \| `tests/integration/AGENTS.md`, `tests/security/AGENTS.md` \| Testes localizados nos módulos/plataforma; não declarados prontos só pelo AGENTS \|

> L34: 5. **Q10 histórico:** seu registro de falha de CI reflete SHA anterior; o [run atualizado](https://github.com/delmacy/syndes-system/actions/runs/43340637846) comprova recuperação do pipeline, mas não aprovação dos Product Gates.

> L40: **Entrega desta atualização:** referência do conjunto de testes, responsabilidades, matriz de requisitos/negativas, diagrama de execução, riscos e STATUS, sem alterar código de testes de produto, CI, scripts operacionais ou ambientes.

> L46: \| 2026-11-12 \| `bd0aa69349879485156ce05ffcb211904d34c206`, DevServer01/worktree isolada \| Leitura de fontes/AGENTS/estratégia e consulta do [CI verde](https://github.com/delmacy/syndes-system/actions/runs/43340637846) \| Homologação QA, performance, restore real, Product Gate \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA ESTÁTICA PARCIAL — 12/11/2026.** Checkout `origin/main` SHA `bd0aa69349879485156ce05ffcb211904d34c206`, DevServer01/worktree isolada. Q01 não é app/backend: sua fonte canônica é `tests/` e os testes executáveis do Syndes estão distribuídos pelos módulos. O [CI no SHA auditado](https://github.com/delmacy/syndes-system/actions/runs/43340637846) passou **24/24 jobs**, em ambientes de ensaio.

> L8: - **Q01:** `tests/AGENTS.md`, `tests/platform/*`, `tests/integration/AGENTS.md`, `tests/security/AGENTS.md` e `tests/performance/AGENTS.md`; as subáreas de testes têm owners específicos.

> L23: \| `platform-manager-keycloak-ci.mjs` \| `tests/platform` \| Testes de realm e tokens assinados de Keycloak efêmero \|

> L31: **Q01 não publica endpoints HTTP, contratos OpenAPI, eventos do Event Bus, classes de domínio, exports de package ou schemas/migrations próprios**. O contrato com o CI é **executar testes e emitir exit code/resultado**, correlacionados ao SHA, job, ambiente e negativa verificada. APIs e objetos SQL testados pertencem a suas unidades de runtime.

> L40: - [Estratégia de testes](../../engineering/TEST-STRATEGY.md) define unit/integration/security/RC e stress/spike/soak. Planejar 2500 tenants **não** prova suportar 2500 tenants.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/06-wbs-marcos-e-aceite.md)

> L5: \| ID \| Entregável no planejamento \| Estado registrado pela WBS \| Evidência de hoje \|

> L8: \| **95.01** \| Definition of Done transversal e evidência por pacote \| **PEND** \| AGENTS e matriz de critérios existem; aprovação formal por owners ainda requerida \|

> L16: \| Testes de estrutura \| Execução exit 0 + SHA \| Verificação local da Q01 a registrar no STATUS após validação \|

> L17: \| CI central \| Run e Gate success no SHA \| **Comprovado na baseline** `bd0aa69`, 24/24 \|

> L27: - **Q01.DOC.03 (candidato):** consolidar matriz de coverage e critérios de RC com produto e operações — **pendente de evidência**.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
