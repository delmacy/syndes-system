---
title: "P14 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L13: \| **Documentação P14** \| **Auditoria parcial**: 8 capítulos, contratos, diagrama, WBS e referência técnica reconciliados \| Aprovação de arquitetura pelos owners continua pendente \|

> L15: \| **Core Kernel A08** \| `packages/core-kernel`: `CoreKernel`, `ModuleRegistry`, ports, `SyndesPlugin`, eventos tipados \| Package privado; implementação e testes pertencem a A08 \|

> L18: \| **Eventos** \| `platform-event-*.ts`, contratos `platform-events.ts` e `control-plane-events.ts` identificados \| Worker admission/composição manual **não são scheduler ativo nem DDL produtivo** \|

> L29: \| `packages/core-kernel/src/index.ts` e `package.json#exports` \| Exports tipados do Kernel `@syndes/core-kernel` \| SDK externo publicado \|

> L48: - [Escopo](ESCOPO.md): requisitos, capacidades, contratos e diagramas por owner.

> L58: \| 2026-11-12 \| `e2c5194`, worktree documental P14 \| Reconciliação estática de código e política, sem mutações de runtime \| Aprovação dos contratos e Product Gate \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L10: \| A08 — Core Kernel \| `packages/core-kernel/package.json`, `src/index.ts`, `kernel.ts`, `module-registry.ts` \| Node 22+/TypeScript; `@syndes/core-kernel` versão 0.1.0 **privada**, `exports["."]` apenas \|

> L13: \| Plataforma de eventos \| `packages/core-kernel/src/*events.ts`, `apps/core-host/src/platform-event-*.ts` \| Contrato tipado + publicação/dispatch/manual batch **opt-in**, não scheduler automático \|

> L18: Os nomes abaixo são **exports públicos reais** de `packages/core-kernel/src/index.ts`; não são classes/métodos pertencentes à P14.

> L29: \| `resolveApprovedModules`, `projectTenantModuleStates` \| Contratos de catálogo e lifecycle; operacionalidade depende de adapters reais \|

> L31: **Contrato de import:** `@syndes/core-kernel` (entrypoint público), nunca `@syndes/core-kernel/src/*.ts`. O package tem `private:true`, sem publicação pública aprovada.

> L43: \| `GET /modules/:moduleId/config` \| Retorna `issuer/clientId` de plugin aprovado com OIDC público configurado \|

> L51: - A04 provê `TenantPgProvider`, adapters, publishers e dispatchers; A08 define o contrato. Workers automáticos, grants reais e DDL operacional dependem de gates separados.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

> L16: - [Contratos públicos](../../standards/CONTRATOS-PUBLICOS.md).

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **P14 não possui package.json, controller HTTP, export JavaScript, serviço NestJS ou esquema SQL.** O contrato normativo dessa unidade é o `AGENTS.md` e as decisões aprovadas. As interfaces reais abaixo possuem owners separados.

> L7: \| Fonte e interface real \| Contrato público e responsabilidade \| Consumidores \|

> L9: \| `package.json#exports["."]`, `src/index.ts` \| `@syndes/core-kernel`: **único import público do pacote**; caminhos `src/*` internos não são API \| Host e módulos autorizados \|

> L28: \| `main.ts` \| `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config` \| Rotas do **Host**, não API P14; config OIDC pública sem segredo \|

> L35: - **Público do Kernel:** `@syndes/core-kernel`; `src/index.ts` enumera símbolos. `private: true` impede tratar como SDK npm distribuído.

> L36: - **Interno do Host:** `apps/core-host/src/*` não deve ser importado diretamente por outros módulos como SDK público. Usar tokens/ports injetados e contratos versionados aprovados.

> L37: - **Privado do tenant:** credenciais, DSN, membership e transações; nunca criar interface que aceite nome do DB vindo do navegador.

> L41: Qualquer alteração em API, export, ACL, SQL, eventos ou composição cross-owner precisa de revisão, WBS/ADR/PR e suites de consumidores. Esta auditoria **não** altera contratos executáveis.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
