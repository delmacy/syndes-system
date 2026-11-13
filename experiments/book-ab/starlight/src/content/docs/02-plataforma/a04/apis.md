---
title: "A04 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/REFERENCIA-TECNICA.md)

> L9: - **Interfaces públicas:** `CoreKernel`, `SyndesPlugin`, `ModuleDefinition` pertencem a `modules/core-kernel` e aos plugins; classes internas do Host não devem ser consumidas como API pública.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/OPERACAO.md)

> L8: 2. Inventariar controllers e contratos HTTP/SSE de cada plugin. Conferir ordem de JWT → membership → FGA → gates Control; documentar negativas cross-tenant e org/workspace.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/04-contratos-e-dependencias-publicas.md)

> L3: - HTTP Core Host: `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config`, `POST /v1/tenants/:tenantId/authorize`. Rotas de plugin são **contratos dos owners**, não do Host.

> L7: - `ModuleDefinition`/`SyndesPlugin` pertencem ao Kernel. Não consumir classes de `main.ts` como API pública.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
