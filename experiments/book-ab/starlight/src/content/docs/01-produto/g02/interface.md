---
title: "G02 · Frontend e interfaces"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Frontend e interfaces

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)

> L23: \| `CORE-CRM-MVP-ACCEPTANCE.md`, `CORE-CRM-FRONTEND-COMPLETION.md` \| Backend/frontend e testes locais descritos; CRM **incompleto** como produto \| Browser com identidades/perfis reais, usabilidade, backup/restore e Product Gate \|

> L24: \| `PRD-002-INBOX-ACCEPTANCE.md`, `INBOX-FRONTEND-PROGRESS.md` \| Inbox em desenvolvimento; SSE descrito posteriormente ao polling inicial \| E2E de SSE/isolamento/identidade, rollout e Product Gate \|

> L26: \| `ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md` \| Contextos Workspace/Manager/Support separados; `front-shared` visual \| Não prova separação de sessões/permissões implantada \|

> L32: 2. **CRM/Inbox:** checklists de implementação/UX não equivalem a aceite real. Exigir testes com JWT/Keycloak, OpenFGA e dados isolados por tenant; frontend mockado não basta.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/REFERENCIA-TECNICA.md)

> L8: - **Atores e superfícies reais a conferir:** `apps/workspace-web` (A01), `apps/master-admin-web` (A02) e `apps/support-web` (A03). Componentes de apresentação em `packages/front-shared` (A07).

> L18: \| A01 Inbox \| `apps/workspace-web/src/features/inbox.tsx`, `inbox-thread.ts`, `inbox-rules.ts`, `inbox-context.tsx` \| Conversa, fila, handoff, contexto e interface; gates P02/A01 \|

> L22: \| A07 Front Shared \| `packages/front-shared/package.json` \| Componentes de apresentação; sem compartilhamento de sessão/identidade \|

> L31: - Realtime SSE descrito em [checkpoint Inbox](https://github.com/delmacy/syndes-system/blob/main/docs/product/INBOX-FRONTEND-PROGRESS.md) está registrado como incremento local com gates reais pendentes.

> L36: **Fluxo de consulta:** [especificação e histórias G02](ESCOPO.md), [matriz de UX](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md), [CRM](https://github.com/delmacy/syndes-system/blob/main/docs/product/CORE-CRM-FRONTEND-COMPLETION.md) e [Inbox](https://github.com/delmacy/syndes-system/blob/main/docs/product/INBOX-FRONTEND-PROGRESS.md). O desenho de produto mantém Workspace para Account/Organizatio

> L38: Estados de carregamento/erro/negação e adaptação mobile precisam ser verificados por módulo e papel. Capturas/mock de frontend não comprovam autorização com Keycloak e OpenFGA reais.

> L42: **G02 não possui database, schema ou migration.** As fontes de dados pertencem aos respectivos domínios e ao Control Plane. `Platform Organization` não é `CRM Organization`; `Conversation` não é `Attendance Protocol`. Não inferir dados operacionais de telas previstas ou de diagramas.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [03-capabilities.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/03-capabilities.md)

> L9: \| **P01 CRM** \| Pessoas, organizações de relacionamento, tags, notas, vínculos e ficha no Workspace \| [Aceite CRM](../../../product/CORE-CRM-MVP-ACCEPTANCE.md), [UX CRM](../../../product/CORE-CRM-FRONTEND-COMPLETION.md) \| Código/UX descritos e arquivos React encontrados; **Product Gate final pendente** \|

> L10: \| **P02 Inbox** \| Fila e histórico, atribuição, resposta, nota, handoff e contexto CRM \| [PRD-002](../../../product/PRD-002-INBOX-ACCEPTANCE.md), [UX Inbox](../../../product/INBOX-FRONTEND-PROGRESS.md) \| Incrementos frontend e SSE documentados; **E2E real, autorização e release pendentes de confirmação** \|

> L14: \| **A01/A02/A03** \| Workspace, Manager e Support em apps isolados \| [ADR frontend/backend](../../../engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md) \| Código de frontends encontrado; acesso real cross-context e publicação não verificados na G02 \|

> L20: Estar **no escopo comercial futuro** não significa que telas, APIs e regras já estejam liberadas. A liberação depende dos Product Gates próprios; não criar botões que antecipem capacidade.

> L31: O projeto mantém código de frontend em `apps/workspace-web/src/features/{crm,inbox,whatsapp-accounts}.tsx`, Manager em `apps/master-admin-web` e Support em `apps/support-web`; isso é inspeção do checkout, **não** um atestado de usabilidade ou deploy.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L23: \| CRM \| Listar/cadastrar/editar pessoas e organizações; relações, tags, notas e CSV \| `apps/workspace-web/src/features/crm.tsx`, `crm-person-detail.tsx`; [checkpoint](../../../product/CORE-CRM-FRONTEND-COMPLETION.md) \| Keycloak/OpenFGA de perfis distintos, acessibilidade e Product Gate \|

> L24: \| Inbox \| Filas, histórico, resposta, nota, handoff, contexto CRM e atualização \| `apps/workspace-web/src/features/inbox.tsx`, `inbox-thread.ts`; [checkpoint](../../../product/INBOX-FRONTEND-PROGRESS.md) \| SSE E2E real/multi-instância se aplicável, autorização e regressão \|

> L27: \| Atendimento Basic \| Lista/Kanban simples e inspector vinculado à Inbox \| [PRD-003A](../../../product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md) \| Sem assumir tela operacional só por previsão no PRD \|

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
