---
title: "G01 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 12/11/2026.** Revisão **estática de documentação, catálogo, manifests e código** no checkout de `origin/main` SHA `b73f42adf47a9b766790f399e13529b470aef171` (DevServer01/worktree isolada). Não foram executados deploy, migrações, testes de autorização com serviços reais ou Product Gate. **Revisão documental não é homologação arquitetural.**

> L7: \| Dimensão \| Estado constatado \| Evidência e limite \|

> L12: \| **Integração** \| **Não verificada nesta auditoria** \| G01 não executou testes reais Keycloak/OpenFGA, PostgreSQL tenant A/B ou fluxo de Event Bus \|

> L14: \| **Escopo e gates** \| **Revisão/aprovação pendentes** \| Documentação anterior não aprovada; decisões dos ADRs mantêm seus próprios estados \|

> L18: \| Fonte conferida no SHA \| Evidência estática encontrada \| O que **não** comprova \|

> L34: 3. Schemas PostgreSQL por módulo e migração de tabelas `public` são evolução por gates; **não há evidência nesta auditoria de migração completa nem de ACL aplicada no ambiente**.

> L36: 5. Não se executaram testes de integração, E2E, restore, autorização real ou verificação de deploy nesta revisão; o CI da futura SHA documental também requer checagem separada.

> L48: 2. **G02 — Produto e UX:** auditar escopo/PRDs, prioridades, jornadas e Product Gates, conforme sequência aprovada.

> L49: 3. **G03/Q10/Q07:** rastreabilidade de ADR e evidências de qualidade/CI; não editar workflows nesta frente documental.

> L57: **Critério para subir de “auditoria parcial”:** aprovar a descrição com os owners, solucionar ou formalizar divergências, verificar a SHA integrada e registrar evidências de testes/gates relevantes. Não confundir documento publicado com Product Gate concluído.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L45: - **Eventos:** `platform_events` no tenant e `control_events` no Control têm owners e gates distintos. Ver [matriz de dados da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

> L52: - **Testes de execução:** não realizados nesta auditoria; a revisão verifica documentação e estrutura estática. Testes CI dos documentos serão registrados separadamente quando executados.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/06-wbs-marcos-e-aceite.md)

> L5: A associação de G01 em `catalog/evolution-associations.json` **não transfere ownership nem prova execução**. As referências existentes são: 00.01 (baseline da `main`), 30.01 (matriz de papéis), 55.01 (recorte Basic de atendimento), 60.01 (gate multi-org), 80.01 (funil avançado, congelado) e 90.01 (métricas sanitizadas); ver [Evolução](../EVOLUCAO.md) e [WBS mestre](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md

> L9: \| Tarefa documental \| Evidência / saída \| Situação em 12/11/2026 \|

> L21: 3. A WBS e as ADRs ficam ligadas a decisões e evidências; mudanças de arquitetura exigem novo gate, não atualização silenciosa de texto.

> L22: 4. Quality Gates registra a evidência de testes e CI por SHA; nenhuma afirmação de integração depende apenas de presença de arquivo.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
