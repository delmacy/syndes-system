---
title: "G02 · Schemas e migrations"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Schemas e migrations

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)

> L10: \| **Implementação da G02** \| **Não aplicável (governança)** \| `docs/product` é fonte de documentação; não package, API ou tabela operacional \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/REFERENCIA-TECNICA.md)

> L7: - **Owner G02:** `docs/product` conforme `catalog/work-units.json`. Arquivos Markdown/PRD e decisões são a fonte documental; **não há `package.json`, API HTTP, classes ou migrations próprios da G02**.

> L42: **G02 não possui database, schema ou migration.** As fontes de dados pertencem aos respectivos domínios e ao Control Plane. `Platform Organization` não é `CRM Organization`; `Conversation` não é `Attendance Protocol`. Não inferir dados operacionais de telas previstas ou de diagramas.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/OPERACAO.md)

> L3: > **ÍNDICE DE FONTES, NÃO RUNBOOK HOMOLOGADO.** Não executar migrations, alterar permissões ou ativar workers apenas com esta página.

> L31: 3. Confirmar migrations realmente aplicadas, backup/restore e rollback antes de SQL.

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/04-contratos-e-dependencias-publicas.md)

> L5: **G02 não publica bibliotecas, controllers HTTP, esquemas SQL, eventos ou endpoints.** Seus artefatos públicos são decisões e **contratos de produto**: PRDs, escopo, ordem de entrega, critérios de aceite, jornadas, exclusões e Product Gates, todos versionados em `docs/product`.

> L28: **Contratos técnicos:** consultar as abas de [APIs](../../../blueprint/APIS.md), [Dados](../../../blueprint/DADOS.md) e [Contratos por owner](../../../blueprint/CATALOGO-MODULOS.md). Contrato citado num PRD pode ser **planejado** e não estar montado na aplicação. `package.json#exports`, fonte HTTP, events e migrations pertencem aos owners executáveis.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L25: \| Manager \| Metadados globais sem dados privados tenant \| `apps/master-admin-web/src/App.tsx`, `src/app/ManagerShell.tsx` \| Roles SQL, OIDC, grants e deploy alvo \|

> L33: **G02 não tem database, tabelas ou migrations próprias.** A UI usa dados dos serviços autorizados, nunca conecta diretamente ao PostgreSQL; o servidor verifica identidade, membership, módulo e autorização em cada recurso. Não usar `tenantId`, `organizationId` ou `assignedTo` enviados pelo browser como concessão de privilégios.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
