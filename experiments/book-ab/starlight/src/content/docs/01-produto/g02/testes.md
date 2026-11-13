---
title: "G02 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL (produto/UX e fonte estática) — 12/11/2026.** Checkout `origin/main` SHA `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9`, DevServer01/worktree isolada. Revisão dos PRDs, ADRs, fonte de React e contratos documentados. Não foram executados browser autenticado, testes de tenant real, deploy, alteração de banco ou aceite do produto.

> L7: \| Dimensão \| Estado \| Evidência e limite \|

> L12: \| **Integração** \| **Não verificada na G02** \| Faltam evidências de jornadas E2E reais por perfis Keycloak/OpenFGA e tenant \|

> L14: \| **Product Gates** \| **Não promovidos** \| Escopo PRD-003A aprovado; CRM/Inbox e módulos posteriores dependem dos respectivos gates \|

> L18: \| Referência \| Estado de produto registrado \| Limite da evidência \|

> L21: \| `PRD-003A-GESTAO-ATENDIMENTOS-MVP.md` \| **Recorte Basic aprovado em 11/11**, entre WhatsApp e Scheduling \| SM-01–06 e Product Gate ainda devem ser verificados \|

> L23: \| `CORE-CRM-MVP-ACCEPTANCE.md`, `CORE-CRM-FRONTEND-COMPLETION.md` \| Backend/frontend e testes locais descritos; CRM **incompleto** como produto \| Browser com identidades/perfis reais, usabilidade, backup/restore e Product Gate \|

> L24: \| `PRD-002-INBOX-ACCEPTANCE.md`, `INBOX-FRONTEND-PROGRESS.md` \| Inbox em desenvolvimento; SSE descrito posteriormente ao polling inicial \| E2E de SSE/isolamento/identidade, rollout e Product Gate \|

> L27: \| Código React em `apps/*/src` \| Arquivos de CRM, Inbox, WhatsApp, Manager e Support presentes \| Presença de fonte sem teste nesta revisão \|

> L32: 2. **CRM/Inbox:** checklists de implementação/UX não equivalem a aceite real. Exigir testes com JWT/Keycloak, OpenFGA e dados isolados por tenant; frontend mockado não basta.

> L33: 3. **SSE da Inbox:** documento anterior indica polling; checkpoint posterior descreve SSE com testes locais, sem E2E e homologação operacional.

> L50: 3. **Owners P01/P02/P03/P05:** conferir produto versus código e Product Gates com testes reais; reconciliação de status técnico em suas ondas.

> L54: \| Data \| SHA/ambiente \| Evidência \| Não comprovado \|

> L58: **Critério para sair de auditoria parcial:** revisão formal da matriz pelo responsável, conciliação de versões dos PRDs e evidências dos owners em seus Product Gates. Publicar documentação não conclui MVP.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA DOCUMENTAL E DE FONTE ESTÁTICA PARCIAL — 12/11/2026.** Revisão do checkout `origin/main` SHA `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9`. G02 é governança de requisitos, experiências e Product Gates, **não** pacote executável. Nenhuma verificação de UX com identidade real, deploy ou banco operacional foi executada nesta auditoria.

> L15: \| Superfície \| Arquivos presentes no checkout \| Responsabilidade de produto / evidência \|

> L17: \| A01 Workspace \| `apps/workspace-web/src/App.tsx`, `src/features/crm.tsx`, `crm-person-detail.tsx` \| CRM e operações por capability; gates reais no P01/A01 \|

> L18: \| A01 Inbox \| `apps/workspace-web/src/features/inbox.tsx`, `inbox-thread.ts`, `inbox-rules.ts`, `inbox-context.tsx` \| Conversa, fila, handoff, contexto e interface; gates P02/A01 \|

> L24: Código presente em arquivo e relatos históricos de testes **não provam** que a jornada esteja publicada, autorizada ou homologada.

> L31: - Realtime SSE descrito em [checkpoint Inbox](https://github.com/delmacy/syndes-system/blob/main/docs/product/INBOX-FRONTEND-PROGRESS.md) está registrado como incremento local com gates reais pendentes.

> L46: - [STATUS](STATUS.md) distingue documentação, implementação, integração, operação e Product Gate.

> L48: - [Escopo aprovado/planejado](ESCOPO.md) e [gates](chapters/06-wbs-marcos-e-aceite.md) exigem evidência por SHA/ambiente.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/06-wbs-marcos-e-aceite.md)

> L8: - **Ordem de auditoria documental:** [plano das 57 unidades](../../../blueprint/PLANO-ATUALIZACAO-MODULOS.md). G02 é segunda unidade; ordem de documentação **não muda** Product Gates.

> L12: \| Recorte \| Aceite de produto obrigatório \| Evidência ainda necessária / gate \|

> L14: \| CRM \| Jornada completa com dados consistentes, permissões corretas e UX funcional \| E2E real por perfis/tenants, acessibilidade, recovery, Product Gate P01 \|

> L15: \| Inbox \| Conversa, atribuição, resposta, nota, handoff, histórico e negativa \| Realtime seguro, teste de identidade/isolamento real, recuperação e Product Gate P02 \|

> L17: \| Atendimento Basic \| Funil configurável, protocolo único, etapa válida, responsável autorizado, trilha auditável, lista/Kanban/inspector \| Gates SM-01–06, transações, grants, E2E, restore, aceite e aprovação de Product Gate \|

> L28: \| G02.DOC.03 (candidato, não incluído na WBS) \| Reconciliar PRDs históricos e status dos módulos com Product Gate atual \| **Pendente de evidências dos owners** \|

> L32: Não registrar percentual de progresso porque **quantidade de interfaces, commits, migrations ou testes isolados não mede aderência aos critérios de aceite**. Avançar documentalmente para G03 depois desta revisão parcial, mas manter as pendências de G02 até aprovação do responsável.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
