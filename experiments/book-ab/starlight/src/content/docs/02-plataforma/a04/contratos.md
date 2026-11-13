---
title: "A04 · Contratos públicos e privados"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Contratos públicos e privados

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)

> L21: \| A04.DOC.01 \| **AUDITORIA PARCIAL** \| Contratos, ownership e capítulos reconciliados com testemunhas de símbolos \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/REFERENCIA-TECNICA.md)

> L9: - **Interfaces públicas:** `CoreKernel`, `SyndesPlugin`, `ModuleDefinition` pertencem a `modules/core-kernel` e aos plugins; classes internas do Host não devem ser consumidas como API pública.

> L10: - **Dependências:** C01 Control para membership, lifecycle e catálogo; C03 Keycloak para JWT; C04 OpenFGA para permissões; C05 OpenBao para secrets; C06 Event Platform para entrega. Esses owners mantêm seus próprios contratos.

> L34: \| GET \| `/modules/:moduleId/config` \| Configuração pública restrita ao contrato do Host; não contém secrets \|

> L63: Fonte navegável: [Core Host no GitHub](https://github.com/delmacy/syndes-system/tree/main/apps/core-host). A URL aponta ao main público e **não** substitui o SHA local do checkpoint.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/OPERACAO.md)

> L8: 2. Inventariar controllers e contratos HTTP/SSE de cada plugin. Conferir ordem de JWT → membership → FGA → gates Control; documentar negativas cross-tenant e org/workspace.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/04-contratos-e-dependencias-publicas.md)

> L3: - HTTP Core Host: `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config`, `POST /v1/tenants/:tenantId/authorize`. Rotas de plugin são **contratos dos owners**, não do Host.

> L7: - `ModuleDefinition`/`SyndesPlugin` pertencem ao Kernel. Não consumir classes de `main.ts` como API pública.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
