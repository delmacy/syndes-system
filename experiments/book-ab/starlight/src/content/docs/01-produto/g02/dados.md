---
title: "G02 · Dados e persistência"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Dados e persistência

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)

> L32: 2. **CRM/Inbox:** checklists de implementação/UX não equivalem a aceite real. Exigir testes com JWT/Keycloak, OpenFGA e dados isolados por tenant; frontend mockado não basta.

> L35: 5. **Manager versus Workspace:** públicos, autenticação e API distintos; papel global não libera dados privados.

> L44: - **Sem alteração de código de produto, PRDs canônicos, CI geral, banco de dados ou infraestrutura.**

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/REFERENCIA-TECNICA.md)

> L42: **G02 não possui database, schema ou migration.** As fontes de dados pertencem aos respectivos domínios e ao Control Plane. `Platform Organization` não é `CRM Organization`; `Conversation` não é `Attendance Protocol`. Não inferir dados operacionais de telas previstas ou de diagramas.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/OPERACAO.md)

*Não há trecho identificável especificamente para esta matéria neste arquivo.*

### [04-contratos-e-dependencias-publicas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/04-contratos-e-dependencias-publicas.md)

> L28: **Contratos técnicos:** consultar as abas de [APIs](../../../blueprint/APIS.md), [Dados](../../../blueprint/DADOS.md) e [Contratos por owner](../../../blueprint/CATALOGO-MODULOS.md). Contrato citado num PRD pode ser **planejado** e não estar montado na aplicação. `package.json#exports`, fonte HTTP, events e migrations pertencem aos owners executáveis.

> L35: - **Frontend:** o Workspace não se fragmenta em um app por domínio, e o Manager não recebe acesso a dados de cliente por possuir papel global.

### [05-arquitetura-banco-interface-configuracao-e-diagramas.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)

> L25: \| Manager \| Metadados globais sem dados privados tenant \| `apps/master-admin-web/src/App.tsx`, `src/app/ManagerShell.tsx` \| Roles SQL, OIDC, grants e deploy alvo \|

> L31: `Customer Account / Tenant` determina o isolamento físico de dados; `Platform Organization` e `Workspace` restringem escopo operacional. P04/Control não são equivalentes a `CRM Organization` (empresa de relacionamento). `Conversation` da Inbox conserva mensagens; `Attendance Protocol` tem identidade, estado, atribuição e histórico próprios, com vínculo **opcional** à conversa.

> L33: **G02 não tem database, tabelas ou migrations próprias.** A UI usa dados dos serviços autorizados, nunca conecta diretamente ao PostgreSQL; o servidor verifica identidade, membership, módulo e autorização em cada recurso. Não usar `tenantId`, `organizationId` ou `assignedTo` enviados pelo browser como concessão de privilégios.

> L38: 2. **Estados explícitos:** loading, vazio real, indisponibilidade, negação e conflito não devem virar dado fictício nem esconder falha de autorização.

> L41: 5. **Concorrência e escopo:** preservar rascunhos após erro de envio; mudança de Organization/Workspace deve revalidar requisições/caches/SSE; não mostrar dados de outro escopo.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
