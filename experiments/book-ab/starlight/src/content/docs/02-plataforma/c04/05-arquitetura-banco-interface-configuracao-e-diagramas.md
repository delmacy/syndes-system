---
title: "C04 · Arquitetura, dados e interfaces"
description: "Volume Plataforma e core · capítulo C04 · matéria 05"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 5. Arquitetura, banco, interface, configuração e diagramas

```mermaid
flowchart TD
 K[Keycloak C03] --> U[Actor JWT validado]
 U --> T[Membership Control C01]
 T --> F[Check OpenFGA C04]
 F -->|allow| R[Recurso do tenant]
 F -->|deny/error| X[Sem acesso]
 S[Service principal confiável] --> E[Module ENABLED C01]
 E --> W[Org/Workspace ativo]
 W --> G[event_delivery can_process]
 G -->|allow| D[Processamento C06]
 G -->|deny/error| N[Denied/Suspended]
```

**Persistência:** OpenFGA usa PostgreSQL próprio de serviço conforme Compose; `fga-model.json` não é migration SQL Tenant nem Control. `openfga-migrate` pertence à inicialização operacional do provedor.

**Configuração e redes:** arquivo runtime privado montado pelo Compose, sem publicar valores de store, tokens, URLs, endereços internos ou tuples. Container Up não significa modelo instalado. **Frontend:** não existe tela C04; enforcement pertence aos backends.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C04-authorization-openfga/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
