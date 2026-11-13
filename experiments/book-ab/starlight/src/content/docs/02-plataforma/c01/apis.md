---
title: "C01 · APIs e endpoints"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# APIs e endpoints

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Baseline de código `origin/main` SHA `ac8deb8c538f59364c6247964a5b0d42e5fbae2e`; snapshot PostgreSQL DevServer01 `2026-11-13T04:38:21Z`. **Consultas SQL somente leitura, sem dados pessoais ou segredos. Nenhuma migration, grant, role, API, worker, container, backup ou deploy alterado.** Staging e produção não verificados.

> L11: \| **Manager base** \| `platform_operator_access`, `platform_tenant_profiles` presentes; `syndes_master_api` com leitura e sem DML de perfis \| Endpoint Manager completo não testado em HTTP no ambiente \|

> L19: \| **Manager inventário** \| `GET /v1/platform/admin/tenants/:id/modules` existe no código e consulta tabelas ausentes \| **Pode retornar 503** por erro SQL; não testado em HTTP real nesta auditoria \|

> L25: 1. **P0 — Consumer/schema parity:** a API Manager de inventário e os adapters Host consultam tabelas de catálogo/lifecycle que ainda **não existem** no Control do DevServer01. A ausência de objeto SQL não deve ser tratada como lista vazia de módulos.

> L37: \| **20.04** \| Manager API role/AppRole \| BLOQ infra \|

> L38: \| **30.03** \| Account API/SQL delegação \| BLOQ \|

> L40: \| **55.03** \| Installer/entitlements/gates \| API opt-in e teste PG17; Control/restore/FGA reais BLOQ \|

> L56: \| 13/11/2026 \| CI no SHA `ac8deb8` \| [24/24 success](https://github.com/delmacy/syndes-system/actions/runs/43359636260) \| Release operacional e compatibilidade de API live \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/REFERENCIA-TECNICA.md)

> L14: \| A05 \| `apps/master-admin-api/src/server.mjs`, `modules/tenant-module-inventory.mjs` \| HTTP read-only de metadados, com JWT/allowlist e role própria; sem tenant DB \|

> L15: \| A06 \| `apps/account-access-api/src/server.mjs`, `main.mjs` \| Delegação de roles de Account com FGA; contrato SQL `control-account-delegation.schema` \|

> L18: **C01 não tem `package.json`, classes HTTP, frontend ou APIs próprios em `infra/postgres/bootstrap`.** As classes e métodos abaixo pertencem aos owners citados e foram confrontados com arquivos reais, não atribuídos ficticiamente à C01.

> L39: - `PUBLIC CONNECT` ao `syndes_control` revogado conforme I04. Isso **não** comprova políticas FGA, segurança HTTP de todas as APIs ou isolamento em outros hosts.

> L43: \| Proprietário \| Símbolo/endpoint real \| Comportamento e limite \|

> L51: \| A04 Host \| `PgModuleInstaller`, `PgControlInstallAttestor`, `PgControlModuleActivator` \| Contratos de operação trusted, não endpoints de provisionamento público \|

> L52: \| A05 Manager \| `GET /v1/platform/admin/me`, `/summary`, `/tenants`, `/tenants/:id` \| JWT, allowlist `platform_operator_access`, metadados read-only \|

> L53: \| A05 Manager \| `GET /v1/platform/admin/tenants/:id/modules` \| Consulta catálogo/entitlements/installs; tabelas ausentes **podem causar 503** (código trata erro); sem teste HTTP live \|

> L82: - **Diferença fundamental:** **um tenant `active` em registry não significa entitlement, install, ENABLED, API funcional ou worker**.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/04-contratos-e-dependencias-publicas.md)

> L3: **C01 não é um pacote com `export` próprio nem um serviço HTTP específico.** As APIs reais pertencem a A04/A05/A06 e as interfaces portáveis pertencem a A08. O contrato primário do C01 é o **schema Control versionado e suas regras de transição**.

> L26: \| **A05** `apps/master-admin-api/src/server.mjs` \| `GET /v1/platform/admin/me`, `/summary`, `/tenants`, `/tenants/:id`, `/tenants/:id/modules` \| JWT e allowlist de operador; `/modules` depende de tabelas **ausentes** e tende a 503 em caso de erro SQL — **sem teste HTTP real neste host** \|

> L27: \| **A06** `apps/account-access-api/src/server.mjs` \| POST restrito de delegação de roles de conta, com JWT/FGA \| Depende das funções/tabelas Account ainda não instaladas no Control observado \|

> L30: \| **A04** `PgEffectiveModuleAccess.canExecuteModule()` \| Gate de módulo `granted` + `enabled` + metadados/verificação + deps \| **Fail closed** no adapter; somente endpoints migrados para `CoreKernel.executeModule` recebem o gate \|

> L33: **API Manager de inventário:** `apps/master-admin-api/src/modules/tenant-module-inventory.mjs` consulta `module_catalog_versions`, `tenant_module_entitlements` e `tenant_module_installs`; sanitiza a resposta para **não expor schema, DB role, digest ou secret**. Ausência dessas tabelas no Control observado implica falha na consulta, não representação de módulos disponíveis.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L33: \| Registry/membership \| `tenant_registry`, `tenant_memberships` \| Não foi auditada a autorização HTTP de todas as chamadas \|

> L84: - **Frontend:** Platform Manager e Workspace pertencem a apps separados; a API Manager consulta metadados sanitizados, nunca DB ou mensagens dos tenants.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
