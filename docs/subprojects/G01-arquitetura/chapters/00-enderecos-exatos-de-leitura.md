## 0. Endereços exatos de leitura

Esta unidade **G01 — Arquitetura** é governança documental e decisão transversal; **não** corresponde a um módulo NestJS executável, a uma API ou a um schema de banco.

| Fonte | Caminho canônico e finalidade |
|---|---|
| Registro de ownership | [catalog/work-units.json](https://github.com/delmacy/syndes-system/blob/main/catalog/work-units.json) — ID G01, área, source `docs/engineering` |
| Índice documental | [docs/subprojects/index.json](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/index.json) — links por unidade |
| Instruções globais | [AGENTS.md](https://github.com/delmacy/syndes-system/blob/main/AGENTS.md) — MVP, segurança, gates e limites |
| Arquitetura geral | [Core Framework](../../../engineering/CORE-FRAMEWORK-ARCHITECTURE.md), [composição por perfis](../../../engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) |
| Fronteira Control/Tenant | [Control x Tenant](../../../engineering/ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md), [Manager boundary](../../../engineering/ADR-PLATFORM-MANAGER-BOUNDARY.md) |
| Frontends e Backend | [Composição de frontend/backend](../../../engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md) |
| Persistência e ciclo de vida | [Kernel e schemas](../../../engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md) |
| Eventos | [Eventos tenant](../../../engineering/ADR-PLATFORM-EVENTS-20261111.md), [eventos Control](../../../engineering/ADR-CONTROL-PLANE-EVENTS-20261111.md) |
| Contratos de importação | [Contratos públicos](../../../standards/CONTRATOS-PUBLICOS.md), `package.json#exports` do owner |
| Planejamento | [WBS mestre](../../../engineering/WBS-PROGRAMA-SYNDES-20261110.md), [ordem de auditoria](../../../blueprint/PLANO-ATUALIZACAO-MODULOS.md), [G01 STATUS](../STATUS.md) |

**Critério de leitura:** o estado indicado em cada ADR vale para **aquela decisão e baseline**, não prova que a versão atual esteja operacional. Para afirmação de implementação, conferir diretamente o arquivo de código no mesmo SHA; para implantação, CI, configuração e evidências do ambiente-alvo.
