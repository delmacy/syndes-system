# P01 CRM — Diagramas técnicos verificáveis

> **Leitura de código · 13/11/2026.** Estes diagramas representam responsabilidades, fluxos e relações declaradas. Não comprovam implantação, migrações aplicadas, consumo ativo de eventos nem homologação de produto. Fontes: `modules/core-crm/src/`, `modules/core-crm/sql/`, `apps/workspace-web/src/features/crm*.tsx` e `STATUS.md`.

## 1. Arquitetura de execução

```mermaid
flowchart LR
  Operator[Operador no Workspace] --> UI[CRM UI]
  UI --> Host[Core Host / CrmController]
  Host --> Guard[CrmDefaultContextGuard]
  Guard --> Kernel[Core Kernel + OpenFGA]
  Guard --> Registry[Control Plane e memberships]
  Host --> Service[CrmService / CrmExtras]
  Service --> Kernel
  Service --> Repo[PgCrmRepository / PgCrmExtras]
  Repo --> Tenant[(PostgreSQL tenant)]
  Service -. contratos de evento .-> Bus[Transactional Event Bus]
  Bus -. consumidor opt-in .-> Identity[CrmWhatsAppIdentityConsumer]
```

**Fronteira:** Control Plane não é `crm_organizations`. Actor, tenant e escopo operacional não vêm do corpo da requisição.

## 2. Modelo entidade-relacionamento — migrations CRM 001–003

```mermaid
erDiagram
  crm_people ||--o{ crm_person_organizations : "person_id"
  crm_organizations ||--o{ crm_person_organizations : "organization_id"
  crm_people ||--o{ crm_person_tags : "person_id"
  crm_tags ||--o{ crm_person_tags : "tag_id"
  crm_people ||--o{ crm_notes : "person_id"
  crm_people ||--o| crm_employees : "person_id unique"
  crm_people ||--o{ crm_channel_identities : "person_id"
  crm_people { uuid tenant_id PK
    uuid id PK
    text name
    text email
    text phone
    timestamptz archived_at
  }
  crm_organizations { uuid tenant_id PK
    uuid id PK
    text legal_name
    text trade_name
    text tax_id
  }
  crm_person_organizations { uuid tenant_id PK
    uuid person_id PK,FK
    uuid organization_id PK,FK
  }
  crm_tags { uuid tenant_id PK
    uuid id PK
    text label
    text label_key
  }
  crm_person_tags { uuid tenant_id PK
    uuid person_id PK,FK
    uuid tag_id PK,FK
  }
  crm_notes { uuid tenant_id PK
    uuid id PK
    uuid person_id FK
    text body
  }
  crm_employees { uuid tenant_id PK
    uuid id PK
    uuid person_id FK
    text job_title
  }
  crm_channel_identities { uuid tenant_id PK
    uuid id PK
    uuid person_id FK
    text channel
    text external_id
  }
```

**Auditoria:** `crm_audit` é a **nona tabela** e mantém `tenant_id`, `actor_id`, `entity_type`, `entity_id`, `action`, `recorded_at`; não há FK para `crm_people` na migration 001. Suas referências são lógicas, não relações físicas. As PKs de negócio incluem `tenant_id` onde definidas. Este ER é resumido; colunas e índices completos estão no inventário de dados e nos arquivos SQL.

## 3. Criação de pessoa — sequência lógica

```mermaid
sequenceDiagram
  actor Actor as Operador
  participant UI as Workspace
  participant API as CrmController / Host
  participant G as Guard de contexto
  participant K as Core Kernel / FGA
  participant S as CrmService
  participant PG as Tenant PostgreSQL
  Actor->>UI: Preencher contato
  UI->>API: POST /people com autenticação
  API->>G: Resolver tenant/organização/workspace
  G->>K: Validar membership + crm:context/read
  K-->>G: Permitido ou negar
  G-->>API: Contexto confiável
  API->>S: createPerson(context, input)
  S->>K: crm:people/write
  K-->>S: Permitido ou negar
  S->>PG: Transação tenant + crm_people / crm_audit
  PG-->>S: Person
  S-->>API: Person
  API-->>UI: Resposta HTTP
```

**Atenção:** a sequência ilustra caminhos presentes no código, não demonstra que os componentes foram integrados com tokens reais em um deploy.

## 4. WhatsApp → Inbox → CRM — evento de identidade

```mermaid
flowchart TD
  I[Inbox observa participante] --> E[inbox.participant.observed.v1]
  E --> C[CrmWhatsAppIdentityConsumer opt-in]
  C --> P[CrmWhatsAppIdentityPolicy.decide]
  P --> Q{Correspondência inequívoca no escopo?}
  Q -->|Sim| R[crm.person.resolved.v1]
  Q -->|Não| V[crm.person.review_required.v1]
  R --> D[Consumidor interessado / verificação de vínculo]
  V --> H[Revisão humana pendente]
  P -. consulta .-> DB[(crm_people + crm_channel_identities)]
```

**Contrato:** tenant, organization e workspace no envelope. A política não cria contato automaticamente; o consumidor não escreve diretamente nos bancos de Inbox ou WhatsApp. Não pressupor tratamento humano já implantado.

## 5. Segurança, autorizações e escopo

```mermaid
flowchart LR
  H[HTTP Bearer] --> T[Identidade e tenant confiáveis]
  T --> C{Contexto e membership}
  C -->|Negado| X[403]
  C -->|Permitido| F{FGA do recurso / ação}
  F -->|Negado| X
  F -->|Permitido| G{Módulo habilitado / gate conforme configuração}
  G -->|Negado| X
  G -->|Permitido| O[CrmService + tenant/org scoping]
  O --> DB[(Tenant DB)]
```

**Limitação:** modo legacy/enforce é condição de rollout; SQL 002 e etapas C2/C3 controlam ativação multi-org. Não remover restrições por inferência documental.

## 6. Portões de publicação e homologação

```mermaid
flowchart LR
  Source[Código versionado] --> Unit[Testes unitários]
  Unit --> CI[CI / contratos]
  CI --> Integration[Keycloak + OpenFGA + tenant A/B]
  Integration --> Browser[Workspace E2E]
  Browser --> Ops[Backup / restore / rollback]
  Ops --> Gate{Product Gate}
  Gate -->|Aceito| Release[Liberação controlada]
  Gate -->|Pendente| Block[Não homologado]
```

**Critério:** `IMPLEMENTED != INTEGRATED != TESTED != PROVEN != DONE`. Resultado de build do Docs Reader não é teste do CRM real.
