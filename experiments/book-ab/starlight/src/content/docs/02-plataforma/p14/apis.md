---
title: "P14 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)

> L17: \| **Módulos e Tenant/Control** \| Implementação dividida por owners; Control ENABLED, membership/FGA/tenancy e tenant DB têm gates próprios \| `executeModule` é opt-in; não declarar enforcement universal sem testar cada endpoint \|

> L42: 6. **Governança:** não transferir API, SQL, frontend, decisões de instalação ou produto dos owners A04/A08/C01/etc. para P14.

> L49: - [Referência técnica](REFERENCIA-TECNICA.md): símbolos e endpoints reais, pertencentes a Kernel/Host.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/REFERENCIA-TECNICA.md)

> L9: \| P14 \| `modules/platform-core/AGENTS.md` \| Política de capacidades transversais, sem package, classes, banco, HTTP ou app \|

> L12: \| Control/tenancy \| `modules/organizations`, `apps/account-access-api`, `apps/core-host/src/module-*.ts` \| Managers/tenants com ownership separado \|

> L14: \| Domínio \| `modules/core-crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service-management` \| API, persistência e comportamento próprios, sob seus owners \|

> L37: `apps/core-host/src/main.ts` define os controllers HTTP concretos do **Host**, não da P14:

> L41: \| `GET /healthz` \| Estado básico `ok` \|

> L42: \| `GET /readyz` \| Verifica CoreService/Control e inicialização do Kernel \|

> L43: \| `GET /modules/:moduleId/config` \| Retorna `issuer/clientId` de plugin aprovado com OIDC público configurado \|

> L44: \| `POST /v1/tenants/:tenantId/authorize` \| JWT verificado, UUID tenant, tenant membership + FGA via `CoreKernel.execute`; resposta deny/falha apropriada \|

> L46: Isso não prova que todos os controllers de domínios tenham sido migrados para o gate de `executeModule`. Não expor `main.ts` como API SDK do Kernel.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **P14 não possui package.json, controller HTTP, export JavaScript, serviço NestJS ou esquema SQL.** O contrato normativo dessa unidade é o `AGENTS.md` e as decisões aprovadas. As interfaces reais abaixo possuem owners separados.

> L9: \| `package.json#exports["."]`, `src/index.ts` \| `@syndes/core-kernel`: **único import público do pacote**; caminhos `src/*` internos não são API \| Host e módulos autorizados \|

> L11: \| `CoreKernel.execute(request, handler)` \| Valida request e sequência membership + autorização de recurso; `Actor` autenticado externamente \| Endpoints conectados \|

> L28: \| `main.ts` \| `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config` \| Rotas do **Host**, não API P14; config OIDC pública sem segredo \|

> L29: \| `main.ts` \| `POST /v1/tenants/:tenantId/authorize` \| JWT, tenant UUID, `CoreKernel.execute`; não é autorização de todos os controllers do sistema \|

> L41: Qualquer alteração em API, export, ACL, SQL, eventos ou composição cross-owner precisa de revisão, WBS/ADR/PR e suites de consumidores. Esta auditoria **não** altera contratos executáveis.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L38: 6. Em falha de membership, FGA, identidade ou infraestrutura, negar a operação protegida; a implementação do erro HTTP depende do Host.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
