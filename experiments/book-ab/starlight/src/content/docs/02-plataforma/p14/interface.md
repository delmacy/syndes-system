---
title: "P14 · Frontend e interfaces"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Frontend e interfaces

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L14: \| **Runtime P14** \| **Não aplicável** — somente `modules/platform-core/AGENTS.md` \| P14 não tem package JSON, controller, banco nem frontend \|

> L42: 6. **Governança:** não transferir API, SQL, frontend, decisões de instalação ou produto dos owners A04/A08/C01/etc. para P14.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L52: - **Nenhum frontend P14.** Workspace e Manager são apps separados; `packages/front-shared` não compartilha credenciais/sessão.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [03-capabilities.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/03-capabilities.md)

> L5: \| Contratos de tenancy/autorização \| **A08** `contracts.ts`, `kernel.ts` \| Interface de Kernel, não enforcement universal automático \|

> L12: \| Componentes compartilhados de frontend \| **A07** `packages/front-shared`; **A01/A02/A03** seus aplicativos \| Visuais compartilhados sem sessão/token/contexto misturados \|

> L15: \| Painel de composição \| CMP-10 opcional \| **Não existe frontend P14** \|

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L87: - **Não existe frontend P14.** Workspace tenant, Manager e Support são aplicativos separados; `front-shared` só fornece UI sem tokens/sessões.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
