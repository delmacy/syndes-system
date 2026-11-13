---
title: "G02 · WBS e critérios de aceite"
description: "Volume Produto e módulos de negócio · capítulo G02 · matéria 06"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/06-wbs-marcos-e-aceite.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 6. WBS, marcos e aceite

### Prioridade de implementação versus prioridade de documentação

- **Fonte de produto:** [MODULE-ORDER](https://github.com/delmacy/syndes-system/blob/main/docs/product/MODULE-ORDER.md) define CRM → Inbox → WhatsApp → **Gestão de Atendimentos Basic** → Scheduling → AI N1 → Documents → Email → Onboarding → Billing → Commercial Website → RC → Launch.
- **Fonte de escopo:** [MVP-SCOPE](https://github.com/delmacy/syndes-system/blob/main/docs/product/MVP-SCOPE.md) define o Basic e as exclusões; [PRD-003A](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md) foi aprovado em 11/11/2026.
- **Execução:** [G02 Evolução/WBS](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/EVOLUCAO.md) relaciona WP-20 (Manager), WP-55 (Basic), WP-70 (módulos futuros), WP-80 (F0–F8 congelado) e WP-95 (go-live). **Associação com WBS não significa DONE.**
- **Ordem de auditoria documental:** [plano das 57 unidades](https://github.com/delmacy/syndes-system/blob/main/docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md). G02 é segunda unidade; ordem de documentação **não muda** Product Gates.

### Critérios de aceite por recorte

| Recorte | Aceite de produto obrigatório | Evidência ainda necessária / gate |
|---|---|---|
| CRM | Jornada completa com dados consistentes, permissões corretas e UX funcional | E2E real por perfis/tenants, acessibilidade, recovery, Product Gate P01 |
| Inbox | Conversa, atribuição, resposta, nota, handoff, histórico e negativa | Realtime seguro, teste de identidade/isolamento real, recuperação e Product Gate P02 |
| WhatsApp Basic | Canal textual vinculado a Inbox/CRM com identidades e eventos coerentes | Conta/canal real autorizado, receipts e integração sob controle, sem homologação presumida |
| Atendimento Basic | Funil configurável, protocolo único, etapa válida, responsável autorizado, trilha auditável, lista/Kanban/inspector | Gates SM-01–06, transações, grants, E2E, restore, aceite e aprovação de Product Gate |
| Manager | Metadados globais e fluxos próprios sem escalada de privilégios | JWT/roles SQL/rede, negações entre client OIDC e dados tenant |
| Support Syndes | Cases segregados internos/externos e notas privadas | Filas, grants, browser, integração e release própria |
| MVP comercial | Produto em produção, tenant replicável, isolamento, Basic operacional, cobrança e restore | Exigência de **pelo menos um cliente externo pagante** segundo MVP-SCOPE |

### WBS da revisão documental G02 (não é nova sprint de produto)

| Item de revisão | Resultado documental | Estado |
|---|---|---|
| G02.DOC.01 | Revisar missão, limites, PRDs e fontes verificáveis | **Auditoria parcial de fontes** |
| G02.DOC.02 (candidato, não incluído na WBS) | Owner validar matriz de escopo, ambiguidades e aceites | **Pendente de aprovação** |
| G02.DOC.03 (candidato, não incluído na WBS) | Reconciliar PRDs históricos e status dos módulos com Product Gate atual | **Pendente de evidências dos owners** |

### Ponto de controle

Não registrar percentual de progresso porque **quantidade de interfaces, commits, migrations ou testes isolados não mede aderência aos critérios de aceite**. Avançar documentalmente para G03 depois desta revisão parcial, mas manter as pendências de G02 até aprovação do responsável.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/06-wbs-marcos-e-aceite.md).
