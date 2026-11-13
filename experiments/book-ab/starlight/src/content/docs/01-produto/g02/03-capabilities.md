---
title: "G02 · Capacidades"
description: "Volume Produto e módulos de negócio · capítulo G02 · matéria 03"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/03-capabilities.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 3. Capabilities e estado do produto

**Separar quatro conceitos:** *escopo comercial aprovado* ≠ *código encontrado* ≠ *teste local* ≠ *Product Gate/produção*. Esta página é um **mapa de leitura**; os owners devem confirmar a situação técnica em seus STATUS por SHA.

### Matriz de módulos prioritários

| Área / owner | Capacidade esperada | Fonte do produto | Situação que a G02 pode afirmar |
|---|---|---|---|
| **P01 CRM** | Pessoas, organizações de relacionamento, tags, notas, vínculos e ficha no Workspace | [Aceite CRM](https://github.com/delmacy/syndes-system/blob/main/docs/product/CORE-CRM-MVP-ACCEPTANCE.md), [UX CRM](https://github.com/delmacy/syndes-system/blob/main/docs/product/CORE-CRM-FRONTEND-COMPLETION.md) | Código/UX descritos e arquivos React encontrados; **Product Gate final pendente** |
| **P02 Inbox** | Fila e histórico, atribuição, resposta, nota, handoff e contexto CRM | [PRD-002](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-002-INBOX-ACCEPTANCE.md), [UX Inbox](https://github.com/delmacy/syndes-system/blob/main/docs/product/INBOX-FRONTEND-PROGRESS.md) | Incrementos frontend e SSE documentados; **E2E real, autorização e release pendentes de confirmação** |
| **P03 WhatsApp** | Canal textual Basic e ligação com Inbox/CRM | [MVP scope](https://github.com/delmacy/syndes-system/blob/main/docs/product/MVP-SCOPE.md), [ordem](https://github.com/delmacy/syndes-system/blob/main/docs/product/MODULE-ORDER.md) | Capacidade do MVP; contratos/eventos em código não comprovam canal operacional homologado |
| **P05 Gestão de Atendimentos** | Funil Basic configurável, protocolo, atribuição, transição, histórico e visualização simples | [PRD-003A](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md) | **Recorte aprovado em 11/11**; gates SM-01–06 independentes de aprovação de escopo |
| **P06 Syndes Support** | Cases internos/externos segregados da própria fornecedora | [PRD Support](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-SYNDES-SUPPORT.md) | Contrato e projeto existentes; não classificar como motor genérico para clientes |
| **A01/A02/A03** | Workspace, Manager e Support em apps isolados | [ADR frontend/backend](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md) | Código de frontends encontrado; acesso real cross-context e publicação não verificados na G02 |

### Sequência comercial posterior prevista no MVP

Segundo [MODULE-ORDER.md](https://github.com/delmacy/syndes-system/blob/main/docs/product/MODULE-ORDER.md): **Scheduling (P07)** → **AI First-Level Assistant (P08)** → **Documents (P09)** → **Email (P10)** → **Onboarding (P11)** → **Subscription & Billing (P12)** → **Commercial Website (P13)** → Release Candidate → Launch.

Estar **no escopo comercial futuro** não significa que telas, APIs e regras já estejam liberadas. A liberação depende dos Product Gates próprios; não criar botões que antecipem capacidade.

### Limites do pacote Basic e exclusões

- [MVP-SCOPE](https://github.com/delmacy/syndes-system/blob/main/docs/product/MVP-SCOPE.md): **um número WhatsApp por Basic**, inicialmente até **3 usuários**, com preço **planejado** R$ 69,90 nos meses 1–2 e R$ 129,99 a partir do terceiro; não tratar valores como oferta ativada ou cobrança operacional.
- **Pós-MVP congelado:** Instagram como canal operacional, Calendar, engine genérica de automações, CRM/pipeline comercial avançado, construtor F0–F8, estoque/ERP, múltiplos WhatsApp, marketplace e white-label.
- **Syndes Support** é atendimento interno/externo da própria plataforma e não substitui **P05** em clientes.
- **Entitlement e licença:** módulos contratados/habilitados precisam de controle de tenant e autorização real; menu visível não é prova de permissão.

### Capacidade de produto versus evidência

O projeto mantém código de frontend em `apps/workspace-web/src/features/{crm,inbox,whatsapp-accounts}.tsx`, Manager em `apps/master-admin-web` e Support em `apps/support-web`; isso é inspeção do checkout, **não** um atestado de usabilidade ou deploy.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/03-capabilities.md).
