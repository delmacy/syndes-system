---
title: "P02 · Arquitetura, dados e interfaces"
description: "Volume Produto e módulos de negócio · capítulo P02 · matéria 05"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 5. Arquitetura, banco, interface, configuração e diagramas

> **Levantamento parcial do código — 12/11/2026.** Componentes abaixo estão presentes no repositório; implantação com identidade real e testes operacionais ainda exigem homologação.

### Componentes e fronteiras

- Módulo: `modules/inbox/src/plugin.ts`, `src/inbox.controller.ts`, `src/service.ts` e `src/postgres.ts`.
- UI consumidora: `apps/workspace-web/src/features/inbox.tsx`. Assets legados do módulo também existem em `modules/inbox/public/`.
- Persistência do módulo: `modules/inbox/sql/001_inbox_foundation.sql`; não adotar tabelas de CRM como propriedade da Inbox.
- Acesso: JWT de identidade confiável, Core Kernel, FGA e contexto de tenant/organização/workspace antes da seleção de banco; não há grants automáticos apenas por definir permissões.
- Atualização de interface: SSE de invalidação por escopo com fallback para HTTP, **em memória de um Host**; não assumir entrega distribuída.

### Diagrama — requisição e atualização de fila

```mermaid
flowchart LR
  UI["Workspace / Inbox"]
  Host["Core Host / API Inbox"]
  Guard["Tenant, organization, workspace e FGA"]
  Service["InboxService"]
  Repo["PgInboxRepository"]
  DB[("Tenant DB")]
  SSE["SSE: invalidação scoped em memória"]

  UI -->|"token / conversa"| Host
  Host --> Guard
  Guard -->|"permitido"| Service --> Repo --> DB
  Service -->|"após sucesso da mutação"| SSE
  SSE -.->|"changed, sem mensagem/PII"| UI
  UI -->|"reconsulta autenticada"| Host
```

### Diagrama — consumidor de WhatsApp e vínculo CRM (opt-in)

```mermaid
sequenceDiagram
  participant WA as Evento WhatsApp
  participant BUS as Platform Events
  participant IN as Inbox Consumer
  participant CRM as CRM Identity
  participant DB as Tenant DB
  WA->>BUS: whatsapp.message.received.v2
  BUS-->>IN: entrega gated
  IN->>DB: conversa e mensagem idempotentes
  IN->>BUS: inbox.participant.observed.v1
  BUS-->>CRM: candidato de identidade
  CRM->>BUS: crm.person.resolved.v1 ou review_required
  opt identidade resolvida e revalidada
    BUS-->>IN: evento resolvido
    IN->>DB: vínculo no escopo autorizado
  end
```

**Gate:** publisher, consumidores e composição existem em código, mas **não** são automaticamente iniciados. O fluxo é candidato para ativação após identidade service, Control ENABLED/FGA, migrações, cutover seguro e testes. Fontes: `modules/inbox/src/whatsapp-event-consumer.ts`, `crm-link-event-consumer.ts`, `apps/core-host/src/platform-event-worker-composition.ts`.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P02-inbox/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
