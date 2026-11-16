# P02 Inbox — Diagramas reconciliados com o código

> **Representação documental em 16/11/2026** a partir da SHA `24018b354392196899332af1581170fb3ad7cf24`. Diagramas demonstram responsabilidade e dependências identificadas; **não comprovam serviço instalado, worker ativo, pipeline de eventos operacional ou Product Gate**.

## 01 · Visão de componentes e ownership (C4 simplificado)

```mermaid
flowchart LR
  OP["Operador / Workspace A01"] --> HOST["A04 Core Host / InboxController"]
  HOST --> G["InboxDefaultContextGuard"]
  G --> IAM["C03 JWT + C04 FGA + memberships P04"]
  G --> SERVICE["P02 InboxService + CoreKernel"]
  SERVICE --> REPO["PgInboxRepository"]
  REPO --> DB[("Tenant DB / inbox_*")]
  HOST -.-> SSE["InboxChangeBus / SSE em memória"]
  SSE -.-> OP
  HOST -. "port opcional" .-> P03["P03 WhatsApp"]
  DB -. "FK person" .-> CRM["P01 crm_people"]
```

**Provas de código:** [controller](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts), [guard](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/context-guard.ts), [service](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/service.ts), [repo](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/postgres.ts). Fluxo do browser requer IAM e mounts reais para estar operacional.

## 02 · Sequência: atender conversa e atualizar UI

```mermaid
sequenceDiagram
  actor O as Operador
  participant UI as Workspace A01
  participant H as Host P02
  participant K as Guard/Kernel/FGA
  participant DB as Tenant DB Inbox
  participant SSE as SSE in-memory
  O->>UI: Busca fila e abre conversa
  UI->>H: GET /conversations?... (Bearer)
  H->>K: JWT, membership, recurso read
  K->>DB: Select tenant/org/workspace
  DB-->>UI: Conversa autorizada
  O->>UI: Atribui / responde / anota
  UI->>H: PATCH ou POST autenticado
  H->>K: Grant write + scope
  K->>DB: Mutação e auditoria
  DB-->>H: Resultado
  H->>SSE: publish changed (sem PII)
  SSE-->>UI: changed / reconsulta
  UI->>H: GET snapshot autorizado
```

**Condição:** para WhatsApp reply `InboxHost.reply` usa o port opcional de P03; enfileiramento **não significa entrega**.

## 03 · Eventos versionados: P03 → P02 → P01

```mermaid
sequenceDiagram
  participant WA as P03 WhatsApp
  participant EB as C06 Platform Events
  participant IN as P02 Inbox consumer
  participant SQL as Tenant DB
  participant CRM as P01 CRM
  WA->>EB: whatsapp.message.received.v2
  EB-->>IN: Consumer opt-in, tenant tx
  IN->>SQL: Canonical chat, upsert conversa/mensagem
  IN->>EB: inbox.participant.observed.v1 (quando aplicável)
  EB-->>CRM: Resolver ou review_required
  opt CRM identifica Person sem ambiguidade
    CRM->>EB: crm.person.resolved.v1
    EB-->>IN: Consumer de vínculo opt-in
    IN->>SQL: FOR UPDATE + revalidar + vincular
  end
```

**Gates abertos:** worker e service principal C06, migrações e roteamento P03, replay e conflitos CRM. Diagrama não autoriza ativação. Fonts: [consumer WhatsApp](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/whatsapp-event-consumer.ts) e [consumer CRM](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/crm-link-event-consumer.ts).

## 04 · ERD: apenas as três tabelas da migration 001

```mermaid
erDiagram
  CRM_PEOPLE ||--o{ INBOX_CONVERSATIONS : "CRM FK tenant-qualified"
  INBOX_CONVERSATIONS ||--o{ INBOX_MESSAGES : "conversation_id + tenant_id"
  INBOX_CONVERSATIONS ||--o{ INBOX_EVENTS : "conversation_id + tenant_id"
  INBOX_CONVERSATIONS {
    uuid tenant_id PK
    uuid id PK
    uuid crm_person_id FK
    string subject
    string channel
    string status
    string assigned_to
    string handoff
    timestamp updated_at
  }
  INBOX_MESSAGES {
    uuid tenant_id PK
    uuid id PK
    uuid conversation_id FK
    string direction
    text body
    string external_message_id
  }
  INBOX_EVENTS {
    bigint id PK
    uuid tenant_id
    uuid conversation_id FK
    string actor_id
    string action
    json detail
  }
```

**Limite intencional:** isto não representa campos adicionais de WA, organização, workspace, favoritos ou unread. Eles precisam de migrations/versionamento reais; ver [inventário](INVENTARIO-TECNICO.md).

## 05 · Fronteiras de confiança e negativas (trust boundary)

```mermaid
flowchart TB
  USER["JWT HTTP / actor verificado"] --> AUTH["Tenant membership + FGA read"]
  AUTH --> MOD{"Module gate enforce?"}
  MOD -->|sim| ENABLED["ENABLED e scope no Control"]
  MOD -->|legacy| DEF["Default org/workspace autorizado"]
  ENABLED --> SELECT["Organização/workspace selecionados e verificados"]
  DEF --> SELECT
  SELECT --> PERM["Permissão concreta da operação"]
  PERM --> DATABASE[("Tenant DB compatível + SQL scoped")]
  USER -. "headers não concedem acesso" .-> SELECT
  DENY["Sem JWT, FGA, backfill ou scope"] -.-> BLOCK["Falha fechada 401/403/503"]
```

**Observação:** os códigos de erro dependem do handler; o desenho não demonstra testes reais A/B. Multi-org e índices 002 dependem de aprovação de owners.

## 06 · Implantação, recovery e estados de validação

| Etapa | Evidência atualmente disponível | Para promover |
|---|---|---|
| Código identificado | `src`, `sql`, `test` em GitHub | Registrar SHA |
| Testes unitários históricos | 34 PASS locais em 12/11 | Reexecutar SHA atual |
| SQL de tenant | 001 presente; extensões identificadas em queries | Inventariar migrations aplicadas/restore |
| Serviço + grants | plugin e permissões declarados | Testar Host, Keycloak, FGA em alvo |
| Event Bus/WA/CRM | consumers opt-in versionados | Provar worker, reprocessamento, cutover |
| UI, dados reais, HA | componentes e SSE in-memory | Browser E2E, acessibilidade, broker/limit |
| Product Gate | Não homologado | Evidência de aceite e rollback |

Não elevar status por documentação, build estático Next.js ou CI de outro módulo.
