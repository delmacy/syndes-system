---
title: "Q01 · WBS e critérios de aceite"
description: "Volume Infraestrutura e qualidade · capítulo Q01 · matéria 06"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/06-wbs-marcos-e-aceite.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 6. WBS, marcos de qualidade e critérios de aceite

A [EVOLUÇÃO](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/EVOLUCAO.md) vincula Q01 aos workitems **00.08, 95.01 e 95.02** da [WBS mestre](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md). O vínculo é documental; não concede ownership dos pipelines nem prova a conclusão do RC.

| ID | Entregável no planejamento | Estado registrado pela WBS | Evidência de hoje |
|---|---|---|---|
| **00.08** | Revalidar release candidate integrado | **BLOQ** no snapshot histórico | CI mainline verde no SHA `bd0aa69`, porém RC/restore operacional não foram auditados |
| **95.01** | Definition of Done transversal e evidência por pacote | **PEND** | AGENTS e matriz de critérios existem; aprovação formal por owners ainda requerida |
| **95.02** | CI integrado por impacto com negativos | **PEND (outra frente)** | Q07 confirmou [24/24 jobs success](https://github.com/delmacy/syndes-system/actions/runs/43340637846) no SHA auditado; não é aceitação de go-live |

### Matriz do aceite de testes versus produto

| Dimensão | Quando considerar comprovada | Situação desta auditoria |
|---|---|---|
| Inventário e autoria de suites | Caminhos/owners/AGENTS encontrados e compatíveis | **Inventário estático revisado** |
| Testes de estrutura | Execução exit 0 + SHA | Verificação local da Q01 a registrar no STATUS após validação |
| CI central | Run e Gate success no SHA | **Comprovado na baseline** `bd0aa69`, 24/24 |
| Integração real de fronteiras | Runs de PG/Keycloak/OpenFGA e negativos | **Comprovados em ambiente GitHub Actions descartável**, nos cenários do run |
| Benchmarks/performance | Métricas comparáveis, hardware, stress/spike/soak | **Não comprovados** |
| Backup/restore de operação | Restore/rollback medido no ambiente-alvo, aceite | **Não comprovado** |
| Homologação do MVP | Jornada real, produto, segurança e operador aprovam | **Não comprovada** |

### WBS documental (não é sprint nova)

- **Q01.DOC.01:** inventariar tipos de prova, executores, environments e owners — **auditoria parcial**.
- **Q01.DOC.02 (candidato):** confirmar suites ausentes, priorizar implementação com Q02–Q09 e módulos — **pendente de revisão**.
- **Q01.DOC.03 (candidato):** consolidar matriz de coverage e critérios de RC com produto e operações — **pendente de evidência**.

**Próxima unidade da sequência:** P14 — Platform Core. Os gaps de performance e aceite permanecem em Q01/Q06/Q08/Q09 e respectivos owners; não abrir benchmark ou migração nesta auditoria documental.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q01-plataforma-de-testes/chapters/06-wbs-marcos-e-aceite.md).
