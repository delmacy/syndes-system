## 5. Arquitetura, banco, interface, configuração e diagramas

> **Levantamento parcial — 12/11/2026.** Documenta fontes e caminhos, não presume conectividade real nem dupla projeção ativada.

### Ownership e componentes

- Go + whatsmeow: `modules/whatsapp/gateway/whatsmeow/` — protocolo/sessões, ingestão e outbound.
- TypeScript: `modules/whatsapp/src/plugin.ts`, `inbound-http.ts`, `outbox.ts`, `event-bridge.ts` — contrato, conta, rotas e persistência do módulo.
- Host confiável: `apps/core-host/config/modules.json` monta o plugin; a ativação do tenant e o worker são gates independentes.
- SQL do módulo: `modules/whatsapp/sql/001_whatsapp_accounts.sql` até `008_whatsapp_projection_owner.sql`; migrações em tenant real somente com autorização e restore.

### Diagrama — separação entre protocolo, API e domínio

```mermaid
flowchart LR
  Provider["WhatsApp / rede externa"]
  Go["Gateway Go whatsmeow"]
  Core["Core Host: validação tenant/account"]
  TS["Módulo WhatsApp TS"]
  Outbox[("Outbox e inbound no tenant DB")]
  Inbox["Inbox: conversa e fila"]
  CRM["CRM: identidade"]

  Provider <--> Go
  Go <-->|"callback / comandos internos autenticados"| Core
  Core --> TS
  TS --> Outbox
  TS -.->|"eventos projetados com gate"| Inbox
  Inbox -.->|"contrato público de identidade"| CRM
```

### Diagrama — exclusividade do projetor inbound

```mermaid
flowchart TD
  Received["Inbound persistido e identificado por conta"]
  Path{"projection_path imutável"}
  Legacy["Projetor legado"]
  Events["Ponte Events opt-in"]
  Dispatcher["Dispatcher e consumidores gated"]
  Gate["Restore, migração 008, versões legadas e FGA/ENABLED"]
  Stop["Bloquear cutover até evidência"]
  Done["Projetar a mensagem uma vez"]

  Received --> Path
  Path -->|"legacy: padrão"| Legacy --> Done
  Path -->|"events: somente após autorização"| Gate
  Gate -->|"aprovado"| Events --> Dispatcher --> Done
  Gate -->|"não aprovado"| Stop
```

**Regra crítica:** nunca permitir dois projetores proprietários do mesmo evento nem mudar `projection_path` histórico para simular rollback. O caminho `events` não está habilitado no runtime por esta documentação. Fontes: `docs/engineering/WBS-WHATSAPP-PROJECTION-CUTOVER-20261111.md` e `apps/core-host/src/platform-event-worker-composition.ts`.
