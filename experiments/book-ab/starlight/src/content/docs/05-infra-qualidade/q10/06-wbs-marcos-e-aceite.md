---
title: "Q10 · WBS e critérios de aceite"
description: "Volume Infraestrutura e qualidade · capítulo Q10 · matéria 06"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/06-wbs-marcos-e-aceite.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 6. WBS e critérios de aceite

A [EVOLUÇÃO](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/EVOLUCAO.md) associa a Q10 aos IDs da [WBS mestre](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md): **00.08, 70.09, 95.01, 95.06 e 95.07**. Essa associação não significa tarefa concluída nem que Q10 executa os contratos de todos os owners.

| Marco WBS | Entregável original | Estado histórico / evidência que falta |
|---|---|---|
| 00.08 | Revalidar release candidate integrado | **BLOQ** na WBS; regressão central e integrações não aprovadas |
| 70.09 | Product Gate individual por módulo | **PEND**; exigir aceite por owner e cenário real |
| 95.01 | Definition of Done e evidência transversal | **PEND**; formalização e assinatura por responsáveis |
| 95.06 | Homologação E2E comercial e tenant isolation | **BLOQ**; identidades/tenants reais e fluxos completos |
| 95.07 | Janela de produção e rollback explícitos | **BLOQ**; digests, backups, janela e responsáveis |

### Marco desta revisão documental

| Item | Evidência produzida | Situação |
|---|---|---|
| Q10.DOC.01 | Integridade, owners, suites e limites reconciliados com código e AGENTS | **Auditoria parcial** |
| Q10.DOC.02 — proposta documental | Revisão de critérios transversais com Q07, QA, segurança e operação | **Ainda não aprovada** |
| Q10.DOC.03 — proposta documental | Checkpoint de CI verde e Product Gates para próximos releases | **Bloqueada por evidência** |

### Critérios para rever o status de Q10

1. Revisão das matrizes e donos das suites pela autoridade técnica.
2. Pipeline principal verde **no SHA indicado**, sem remover ou ignorar testes de paridade.
3. Suites exigidas e gaps do planner analisados, inclusive service-management e fluxos novos.
4. Evidência reproduzível de um fluxo completo: requisito/owner → mudança → CI → ambiente → autorização → gate/aceite.
5. Product Gate/Release operacional só quando o responsável aprovar; não promover Q10 inteira por ter testado arquivos estruturais.

**Próxima unidade no plano:** Q07 — CI central (em sequência após Q10), seguida de Q01; a correção dos workflows é responsabilidade específica de Q07, não parte da auditoria aqui.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q10-quality-gates/chapters/06-wbs-marcos-e-aceite.md).
