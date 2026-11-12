## 5. Arquitetura, banco, interface, configuração e diagramas

> **Levantamento parcial — 12/11/2026.** A unidade `modules/platform-core` é fronteira documental (AGENTS.md), **não** um pacote executável autônomo. Os executáveis e contratos abaixo pertencem a seus próprios owners.

### Diagrama — separação Kernel, Host e módulos

```mermaid
flowchart TB
  subgraph Kernel["Core Kernel — packages/core-kernel"]
    Contracts["Contratos / ports / module definition"]
  end
  subgraph Host["Core Host — apps/core-host"]
    Loader["Loader confiável de plugins"]
    Auth["Adapters: tenant / OIDC / FGA"]
    Installer["Installer operator-only"]
  end
  subgraph Business["Módulos proprietários"]
    Crm["CRM"]
    Inbox["Inbox"]
    WA["WhatsApp"]
  end
  Control[("Control Plane")]
  PG[("PostgreSQL: um DB por tenant")]
  Id["Keycloak"]
  FGA["OpenFGA"]

  Loader --> Contracts
  Loader --> Crm
  Loader --> Inbox
  Loader --> WA
  Auth --> Id
  Auth --> FGA
  Auth --> Control
  Crm --> PG
  Inbox --> PG
  WA --> PG
  Installer -.->|"plan/apply com autorização"| PG
```

O loader fixo de `apps/core-host/config/modules.json` existe; perfis de instância selecionáveis (CMP-03+) e imagem mínima ainda são planejamento. Não criar import de privados de outros módulos para simplificar integração.

### Diagrama — Transactional Outbox e despacho (opt-in)

```mermaid
sequenceDiagram
  participant PROD as Módulo produtor
  participant TX as Tenant DB / transação
  participant PUB as TenantEventPublisher
  participant DSP as TenantEventDispatcher
  participant GATE as WorkerAdmission
  participant CONS as Consumidor dono do módulo

  PROD->>TX: BEGIN e efeito de domínio
  PROD->>PUB: publicar evento tipado/versionado
  PUB->>TX: INSERT outbox na mesma transação
  PROD->>TX: COMMIT
  DSP->>GATE: validar service, ENABLED e FGA
  alt autorizado e handler presente
    DSP->>TX: claim + lease da entrega
    DSP->>CONS: handle dentro da transação
    CONS->>TX: efeito + consumer_inbox + ack
  else indisponível / temporário
    DSP->>TX: suspended / retry
  else negação explícita
    DSP->>TX: dead sem efeito
  end
```

**Estado:** dispatcher, publisher e consumidores opt-in existem e tiveram testes sintéticos/PG17 descritos nas WBS; não há scheduler automático ou Worker admission operacional liberados por essa implementação. Fontes: `apps/core-host/src/platform-event-publisher.ts`, `platform-event-dispatcher.ts`, `platform-event-worker-admission.ts`, `platform-event-worker-composition.ts`.

### Diagrama — gates antes da ativação

```mermaid
flowchart TD
  Types["Contratos + testes unitários"]
  PG17["Testes PG17 descartáveis"]
  Control["Control + migrations + restore real"]
  Identity["Identidade service, ENABLED e grants FGA"]
  Legacy["Migração 008 e exclusividade do projetor"]
  Canary["Staging com canário e rollback"]
  Runtime["Worker operacional autorizado"]

  Types --> PG17 --> Control --> Identity --> Legacy --> Canary --> Runtime
```

Nenhuma seta equivale a uma etapa concluída: o gate avança **somente com evidência verificável e autorização**.
