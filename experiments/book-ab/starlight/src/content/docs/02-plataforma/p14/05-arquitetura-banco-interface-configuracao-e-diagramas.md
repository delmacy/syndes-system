---
title: "P14 · Arquitetura, dados e interfaces"
description: "Volume Plataforma e core · capítulo P14 · matéria 05"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 5. Arquitetura, persistência, interface e diagramas

### Fronteiras de implementação (as-is)

```mermaid
flowchart TB
  Rules["P14: regras e contrato lógico — AGENTS/ADR"]
  K["A08: @syndes/core-kernel — ports, registry, eventos"]
  H["A04: Core Host — NestJS, plugin loader, adapters"]
  C["Control Plane — catálogo, estados, membership"]
  Id["C03 Keycloak — identidade"]
  F["C04 OpenFGA — permissão"]
  B["C05 OpenBao — secrets"]
  M["CRM, Inbox, WhatsApp, Organizations, Support — domínios"]
  T["Tenant databases PostgreSQL"]
  Rules -.-> K
  Rules -.-> H
  H --> K
  H --> C
  H --> Id
  H --> F
  H --> B
  H --> M
  M --> T
```

**P14 não é um processo extra.** A04 importa interfaces de A08 e carrega plugins confiáveis listados em `apps/core-host/config/modules.json`: CRM, Inbox, WhatsApp, Organizations e Support. O pacote `@syndes/service` é dependência de build, mas não está nesse manifesto fixo. A configuração não cria perfis selecionáveis por instância.

### Inicialização/autorizações

A composição do Host é verificada em sequência:

1. Ler `config/modules.json` e importar somente plugins confiáveis já instalados.
2. Ordenar definições no `ModuleRegistry`, recusando dependência circular/ausente.
3. Inicializar o `CoreKernel` e confirmar secrets/Control sem fallback permissivo.
4. Receber `Actor` previamente autenticado pelo Host (Keycloak).
5. Para o entrypoint ligado ao Kernel, exigir `TenancyPort.canAccessTenant` e `AuthorizationPort.canAccess` antes do handler.
6. Em falha de membership, FGA, identidade ou infraestrutura, negar a operação protegida; a implementação do erro HTTP depende do Host.

**Limite de eficácia:** o `CoreKernel.executeModule` existe para gate adicional de módulo, porém é opt-in; não presumir que todos os controllers o utilizam. `platform admin` não ganha acesso ao conteúdo de tenants.

### Transactional Outbox e Worker Admission — artefatos opt-in

```mermaid
sequenceDiagram
  participant PROD as Producer de domínio
  participant TX as Tenant DB / transação confiável
  participant PUB as Event Publisher
  participant DIS as Dispatcher opt-in
  participant GA as Admission Control + FGA
  participant CON as Consumer do owner
  PROD->>TX: Efeito de domínio
  PROD->>PUB: Envelope tipado + versão
  PUB->>TX: INSERT outbox no mesmo commit
  DIS->>GA: ENABLED/serviço/tenant/grants
  alt handler e autorização presentes
    DIS->>TX: Claim com lease
    DIS->>CON: Executa efeito transacional
    CON->>TX: consumer_inbox + ack
  else falha temporária
    DIS->>TX: suspended/retry
  else negação definitiva
    DIS->>TX: dead sem side effect
  end
```

Os artefatos em `apps/core-host/src/platform-event-*.ts` e os contratos em `packages/core-kernel/src/*events.ts` existem; **não existe scheduler automático liberado nem worker operacional homologado**. As migrations do tenant e do Control têm owners e pré-requisitos distintos, sem permissão de aplicar DDL só por documentar.

### Perfis de Core por instância — to-be aprovado, não implementado

```mermaid
flowchart TD
  C1["CMP-01: matriz contratos/ports"] --> C2["CMP-02: schema de profile + validador offline"]
  C2 --> C3["CMP-03: duas composições locais aprovadas"]
  C3 --> C4["CMP-04: build/digest/manifest imutável"]
  C4 --> C5["CMP-05: perfil + ENABLED + FGA"]
  C5 --> C6["CMP-06/08: isolamento, ingress e ownership de workers"]
  C6 --> C9["CMP-09: staging 2 perfis x 2 tenants"]
  C9 --> Gate["Aceite de operação e produto"]
```

Conforme [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md), perfis por instância devem ser artefatos confiáveis imutáveis por build/deploy. Não carregar módulos a partir de requisições de usuários; não inventar comunicação cross-process sem contrato/teste/necessidade.

### Banco, frontend e configuração

- **P14 não tem PostgreSQL, migration ou tabela própria.** Control DB, schema `platform_events` no tenant e migrations dos módulos têm owners separados.
- **Não existe frontend P14.** Workspace tenant, Manager e Support são aplicativos separados; `front-shared` só fornece UI sem tokens/sessões.
- **Configuração implementada:** `apps/core-host/config/modules.json` fixo, runtime secrets/oidc/FGA configurados pelo Host. Valores de credenciais, URLs internas e grants reais **não** devem ser publicados.
- **Segurança:** para ativação de perfis/workers exige Control ENABLED, FGA service grants, schema migrado com backup/restore, canário e rollback autorizados.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
