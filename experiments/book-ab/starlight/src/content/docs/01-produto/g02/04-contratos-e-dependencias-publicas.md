---
title: "G02 · Contratos e dependências"
description: "Volume Produto e módulos de negócio · capítulo G02 · matéria 04"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/04-contratos-e-dependencias-publicas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 4. Contratos, interfaces e dependências

### Contrato da própria G02

**G02 não publica bibliotecas, controllers HTTP, esquemas SQL, eventos ou endpoints.** Seus artefatos públicos são decisões e **contratos de produto**: PRDs, escopo, ordem de entrega, critérios de aceite, jornadas, exclusões e Product Gates, todos versionados em `docs/product`.

| Entrada consumida pela G02 | Saída documental | Responsável pelo fato operacional |
|---|---|---|
| Demanda, decisão do produto e PRD aprovado | Escopo, prioridade, regras e exclusões | G02; implementação pertence ao módulo |
| História/caso de uso e autorização | Critério de aceite e testes negativos esperados | G02 + Q04/Q05 e owner |
| Design UX do Workspace | Jornada e comportamento verificável para operador | A01 e P01/P02/P03/P05 |
| Design do Manager/Support | Regras de navegação e papéis por público | A02/A03/A05/P06 |
| Dependências entre domínios | Matriz de risco e ordem de entrega | G01/A04 e owners dos contratos |
| Evidências de testes/deploy | Parecer de readiness, bloqueios e gate | Q10/Q07/Q04, Operações, owner do módulo |

### Matriz de contratos que não devem ser confundidos

| Contexto | Fonte canônica | Consumidor | Regra de fronteira |
|---|---|---|---|
| CRM: Person e CRM Organization | P01 | Inbox, WhatsApp, Atendimento | Identidade/empresa de relacionamento não é organização da plataforma |
| Inbox: Conversation e Message | P02 | Atendimento/CRM autorizado | Mensagem contínua não é protocolo nem etapa do funil |
| WhatsApp: Account e transporte | P03 | Inbox/Canais | Identidades e receipts não substituem o estado da conversa |
| Workforce/Platform Organization | P04/C01 | Atendimento, Workspace, Manager | Membership e atribuição precisam de grants reais |
| Atendimento: Funnel/Stage/Protocol | P05 | Inspector Inbox, Kanban/Lista | Protocolo próprio e auditável; não reescrever mensagens |
| Syndes Support: Case/Queue | P06 | Suporte da fornecedora | Não vazar caso de tenant nem replicar helpdesk comercial |
| Front Shared | A07 (`packages/front-shared`) | A01, A02 e demais frentes conforme aceite | Somente apresentação; nenhuma sessão, token, fetch de domínio ou autorização |

**Contratos técnicos:** consultar as abas de [APIs](https://github.com/delmacy/syndes-system/blob/main/docs/blueprint/APIS.md), [Dados](https://github.com/delmacy/syndes-system/blob/main/docs/blueprint/DADOS.md) e [Contratos por owner](https://github.com/delmacy/syndes-system/blob/main/docs/blueprint/CATALOGO-MODULOS.md). Contrato citado num PRD pode ser **planejado** e não estar montado na aplicação. `package.json#exports`, fonte HTTP, events e migrations pertencem aos owners executáveis.

### Dependências e decisões abertas

- **CRM → Inbox → WhatsApp → Atendimento Basic** é a sequência de produto; a composição técnica tem dependências próprias. Não presumir ordem de inicialização ou evento apenas pela ordem comercial.
- **Workforce e grants:** transferência entre equipes no mesmo Workspace exige elegibilidade real; sem strings de equipe fictícias, conforme [PRD-003A](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md).
- **Organization multi-context:** protótipo de seleção de contexto não libera multi-organização; os gates #21/#31 e SQL002 permanecem com os owners.
- **Frontend:** o Workspace não se fragmenta em um app por domínio, e o Manager não recebe acesso a dados de cliente por possuir papel global.
- **SSE/realtime e mídia:** o incremento de SSE está documentado como código/testes locais, sem E2E real em múltiplos usuários e tenants; anexos permanecem sujeitos a seu gate. Não declarar realtime/mídia homologados.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/04-contratos-e-dependencias-publicas.md).
