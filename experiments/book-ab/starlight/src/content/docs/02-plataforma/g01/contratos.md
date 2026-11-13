---
title: "G01 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)

> L21: \| `packages/core-kernel/src/index.ts` e `src/contracts.ts` \| Exports públicos de `CoreKernel`, `ModuleRegistry`, `TenancyPort`, `AuthorizationPort`, `TrustedTenantTransactionProvider` e `ModuleAccessPort` \| Enforcement real em todos os endpoints e workers \|

> L24: \| `modules/core-crm/package.json`, `modules/inbox/package.json`, `modules/whatsapp/package.json` \| Superfícies via `exports`; pacote Inbox = `@syndes/core-inbox` \| Rotas HTTP habilitadas, identidade ou integração \|

> L26: \| `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts` \| Tipos/validação de contratos de eventos \| Dispatcher ativo, migrations aplicadas ou replay operacional \|

> L33: 2. Índice `docs/standards/CONTRATOS-PUBLICOS.md` menciona `@syndes/inbox` como nome a verificar; o manifesto P02 declara `@syndes/core-inbox`. Corrigir pelo owner do contrato.

> L40: - [Capítulos da especificação](ESCOPO.md): missão, responsabilidades e exclusões, matrizes, contratos, estados de implementação, diagrama lógico, fontes e pendências.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/REFERENCIA-TECNICA.md)

> L9: - **Arquitetura observada:** `packages/core-kernel` como biblioteca de contratos, `apps/core-host` como composition root NestJS e `modules/*` como pacotes de domínio. Ver [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) e [mapa da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

> L30: - [Superfícies de importação e limites](../../standards/CONTRATOS-PUBLICOS.md): o código `package.json#exports` define o que é público para consumidores.

> L34: - **G01 não publica nem consome eventos como runtime.** Um contrato declarado em Core não comprova producer/consumer ativo.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **Entradas:** ADRs, AGENTS, inventário do catálogo, documentação de owner, WBS, evidências de CI/ambiente e propostas de mudança. **Saídas:** decisões rastreáveis, limites de responsabilidade, diagramas, matrices de conformidade, pendências e links para a fonte. **Não há export TypeScript, API HTTP ou evento produzido pela G01.**

> L9: \| Responsável real \| Fonte no código \| O que o contrato delimita \|

> L13: \| P01 CRM \| `modules/core-crm/package.json` \| Export `.` e `./plugin`; detalhes do domínio pertencem ao P01 \|

> L14: \| P02 Inbox \| `modules/inbox/package.json` \| Pacote **`@syndes/core-inbox`**, exports `.` e `./plugin` \|

> L15: \| P03 WhatsApp \| `modules/whatsapp/package.json` \| Pacote `@syndes/whatsapp`, múltiplos exports de contracts/bridge/plugin; verificar compatibilidade antes de importar \|

> L17: \| C01/C03/C04/C05 \| ADRs de Control, Keycloak, OpenFGA e OpenBao \| Metadados e identidade, relação/recurso e segredos; contratos de infraestrutura e políticas, não API pública da G01 \|

> L19: **Regra:** `export` em um arquivo não implica superfície pública do pacote. Confirmar `package.json#exports`, consumidor, compatibilidade, autenticação e isolamento antes de integrar. O Host deve injetar ports/consumidores; evitar imports de caminhos `src/` privados de outros owners.

> L24: 2. [CONTRATOS-PUBLICOS.md](../../../standards/CONTRATOS-PUBLICOS.md) contém `@syndes/inbox` como rótulo **a verificar**; o `package.json` atual do P02 declara `@syndes/core-inbox`. O owner P02 deve atualizar a ficha normativa e conferir consumidores.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G01-arquitetura/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
