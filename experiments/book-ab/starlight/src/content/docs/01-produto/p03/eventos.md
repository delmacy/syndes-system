---
title: "P03 · Eventos e mensageria"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Eventos e mensageria

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 2026-11-12.** Evidência: worktree `b452a03e`; testes locais sem implantação. NÃO equivale a CI da SHA publicada, integração real, deploy ou Product Gate.

> L7: Pacote TypeScript com contas, outbox, inbound, dispatch, contratos e migrations 001–008; gateway Go/Whatsmeow existe. O plugin consta em apps/core-host/config/modules.json, mas a inscrição não prova módulo habilitado por tenant nem projetor novo operacional.

> L13: \| `modules/whatsapp/src/outbox.ts` \| Artefato presente no checkout; não implica runtime habilitado \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/REFERENCIA-TECNICA.md)

> L16: \| `.` \| `./dist/accounts.js` \| Declaração, não garantia de consumidor instalado \|

> L17: \| `./contracts` \| `./dist/contracts/index.js` \| Declaração, não garantia de consumidor instalado \|

> L18: \| `./crm-link-plan` \| `{"types": "./dist/crm-link-plan.d.ts", "default": "./dist/crm-link-plan.js"}` \| Declaração, não garantia de consumidor instalado \|

> L19: \| `./event-bridge` \| `{"types": "./dist/event-bridge.d.ts", "default": "./dist/event-bridge.js"}` \| Declaração, não garantia de consumidor instalado \|

> L20: \| `./event-identity-reader` \| `{"types": "./dist/event-identity-reader.d.ts", "default": "./dist/event-identity-reader.js"}` \| Declaração, não garantia de consumidor instalado \|

> L21: \| `./event-route-commands` \| `{"types": "./dist/event-route-commands.d.ts", "default": "./dist/event-route-commands.js"}` \| Declaração, não garantia de consumidor instalado \|

> L22: \| `./plugin` \| `./dist/plugin.js` \| Declaração, não garantia de consumidor instalado \|

> L76: \| Plugin NestJS e domínio TypeScript \| `modules/whatsapp/src/plugin.ts` e `modules/whatsapp/src/` \| APIs, contas, contratos, regras, outbox e migrations de negócio \|

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/04-contratos-e-dependencias-publicas.md)

> L2: - Entradas, saídas, APIs, eventos e ports: A INVENTARIAR pela fonte executável.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L8: - TypeScript: `modules/whatsapp/src/plugin.ts`, `inbound-http.ts`, `outbox.ts`, `event-bridge.ts` — contrato, conta, rotas e persistência do módulo.

> L52: **Regra crítica:** nunca permitir dois projetores proprietários do mesmo evento nem mudar `projection_path` histórico para simular rollback. O caminho `events` não está habilitado no runtime por esta documentação. Fontes: `docs/engineering/WBS-WHATSAPP-PROJECTION-CUTOVER-20261111.md` e `apps/core-host/src/platform-event-worker-composition.ts`.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P03-whatsapp/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
