# G01 — Arquitetura | Referência técnica

> **AUDITORIA ESTÁTICA PARCIAL — 12/11/2026.** G01 mantém decisões e matrizes, não é serviço, package executável, controlador HTTP nem schema PostgreSQL. As referências a classes e interfaces abaixo pertencem aos seus respectivos owners e foram examinadas no commit `b73f42adf47a9b766790f399e13529b470aef171`; não comprovam instalação operacional.

## Stack e ownership

- **Unidade e fonte:** `G01` → `docs/engineering`, conforme `catalog/work-units.json` e `docs/subprojects/index.json`.
- **Natureza:** documentação técnica (Markdown/ADRs/WBS/catálogo). **Sem `package.json`, runtime, build de aplicação ou secrets próprios**.
- **Arquitetura observada:** `packages/core-kernel` como biblioteca de contratos, `apps/core-host` como composition root NestJS e `modules/*` como pacotes de domínio. Ver [ADR de composição](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) e [mapa da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
- **Arquitetura ≠ implantação:** o arquivo `apps/core-host/config/modules.json` declara cinco plugins trusted, sem provar ENABLED/entitlement em tenant.

## Backend: classes, métodos e responsabilidades

**Não aplicável à G01 como owner de código.** As referências executáveis pertencem a:

| Owner | Arquivo de fonte | Declarações verificadas na leitura do repositório |
|---|---|---|
| A08 Core Kernel | `packages/core-kernel/src/index.ts`, `module-registry.ts`, `contracts.ts` | `CoreKernel`, `ModuleRegistry`, `TenancyPort`, `AuthorizationPort` e providers tenant |
| A04 Core Host | `apps/core-host/src/module-host.ts`, `main.ts` | `loadInstalledPlugins`, validação de trusted packages, composição Nest |
| C06 Event Platform | `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts` | Eventos tipados e validações, não ativação do worker |

[Catálogo técnico por owner](../../blueprint/CATALOGO-MODULOS.md). As assinaturas completas, visibilidade e histórico devem ser consultados no código e nas páginas de cada unidade.

## APIs HTTP

**A G01 não registra endpoints HTTP.** Os controllers pertencem ao Core Host, módulos de produto e APIs administrativas; conferir as rotas reais, middleware de autorização e montagem na [consulta de APIs por owner](../../blueprint/APIS.md). Nenhum endpoint deve ser inferido de título de ADR ou classe.

## Contratos públicos, APIs e eventos

- [Superfícies de importação e limites](../../standards/CONTRATOS-PUBLICOS.md): o código `package.json#exports` define o que é público para consumidores.
- [Kernel](../../subprojects/A08-core-kernel/REFERENCIA-TECNICA.md): ports, ModuleRegistry e eventos tipados.
- [Core Host](../../subprojects/A04-core-host/REFERENCIA-TECNICA.md): bindings dos ports, plugins trusted e configuração.
- [Event Platform](../../subprojects/C06-event-platform/REFERENCIA-TECNICA.md): outbox, dispatcher, consumers e limites entre Control e tenant.
- **G01 não publica nem consome eventos como runtime.** Um contrato declarado em Core não comprova producer/consumer ativo.

## Frontend: aplicações, telas e componentes

**G01 não possui frontend operacional.** A apresentação do portal é o Syndes Docs; as aplicações são A01 Workspace, A02 Platform Manager e A03 Support, com `packages/front-shared` restrito a componentes visuais. Identidade, sessão e controle de recursos não podem atravessar bundles por simples reuso de UI.

## Schemas e migrations

- **G01:** nenhuma tabela/migration própria; não existe banco de dados de arquitetura.
- **Control Plane:** dados de catálogo e governança sob C01/Manager; não é backend de CRM, Inbox e WhatsApp.
- **Tenant DB:** banco por tenant; o desenho de schemas por módulo é evolutivo e não deve ser declarado aplicado só porque existe um ADR.
- **Eventos:** `platform_events` no tenant e `control_events` no Control têm owners e gates distintos. Ver [matriz de dados da G01](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

## Diagramas, testes e pendências

- [Diagrama e matrizes](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) são **lógicos**, não desenho de infraestrutura homologada.
- [STATUS](STATUS.md) contém SHA, fontes examinadas, divergências e próximo marco.
- [WBS](EVOLUCAO.md) mantém tarefas associadas, não mudança de status implícita.
- **Testes de execução:** não realizados nesta auditoria; a revisão verifica documentação e estrutura estática. Testes CI dos documentos serão registrados separadamente quando executados.
