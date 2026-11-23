# Dossiê do Syndes System

## Parte 1 — Visão geral e decisões de produto

**Rascunho para edição · 23 de novembro de 2026**

Edite a coluna **Minha alteração** com o que você quer manter, retirar ou mudar. Use o campo **Primeira demonstração** para descrever o que você quer ver funcionando.

### O que o Syndes resolve

O Syndes reúne cadastro de clientes, conversas e atendimentos. Uma equipe consegue identificar quem entrou em contato, acompanhar a conversa e conduzir cada solicitação até a conclusão, com responsável, etapa e histórico. [Escopo do MVP](MVP-SCOPE.md) · [Gestão de Atendimentos](PRD-003A-GESTAO-ATENDIMENTOS-MVP.md)

O **Workspace** é a área de trabalho da equipe do cliente. O **Platform Manager** é a área de operação da fornecedora, com visão do cadastro e da situação de cada cliente. O acesso ao catálogo do Manager já foi confirmado no ambiente anterior. O escopo comprovado foi de consulta. [Aceite do Manager](../engineering/PLATFORM-MANAGER-HOMOLOG-DEVSERVER01.md)

### Como o sistema se organiza

| Nível | O que representa | Exemplo fictício |
| --- | --- | --- |
| Conta (tenant) | Cliente contratante, com banco próprio | Grupo Horizonte |
| Organização | Empresa ou unidade administrada pela conta | Horizonte Assistência |
| Workspace | Área de trabalho dentro de uma organização | Atendimento ao cliente |
| Funil | Etapas que uma solicitação percorre naquele workspace | Recebido → Em atendimento → Concluído |

Uma conta pode ter várias organizações. Uma organização pode ter vários workspaces. Cada workspace pode ter seus próprios funis e permissões. O cadastro inicial previsto cria a conta, a primeira organização e o workspace inicial. [Contrato de cadastro](UC-SIGNUP-TENANT-ORGANIZATION-WORKSPACE-WIZARD-20261118.md)

### Fluxo principal

1. Uma mensagem chega pelo WhatsApp e aparece na Inbox.
2. A equipe identifica o contato pelo CRM e continua a conversa pela Inbox.
3. Quando a conversa envolve uma solicitação, o atendente pode abrir um atendimento com protocolo.
4. A equipe atribui um responsável, move o atendimento pelas etapas e registra a conclusão.

A Inbox guarda a conversa. O CRM guarda o cadastro do contato. O funil guarda o andamento da solicitação. Uma mesma conversa pode dar origem a mais de um atendimento. [Aceite da Inbox](PRD-002-INBOX-ACCEPTANCE.md) · [Regras do funil](PRD-003A-GESTAO-ATENDIMENTOS-MVP.md)

### Ponto de partida para o ambiente novo

| Área | O que já sabemos |
| --- | --- |
| Multi-org | O staging anterior demonstrou isolamento entre dois tenants, organizações e workspaces. A evidência usou dados de teste. |
| Funil de atendimento | O staging anterior demonstrou criação e movimentação de atendimento, escopo e revogação. |
| Cadastro de clientes | O contrato do wizard existe. O fluxo completo de cadastro e primeiro acesso está pendente. |
| Desenvolvimento e staging | O Codex Cloud serve para executar tarefas e testes temporários. O Codespace pode hospedar a demonstração privada sob demanda. O ambiente novo ainda precisa ser configurado. |
| DevServer01 | A limpeza ficou a cargo do proprietário. O inventário confirmou que o gateway WhatsApp usa PostgreSQL 17 na instância compartilhada do Syndes. |

[Evidências do staging anterior](../engineering/MULTIORG-STAGING-EXECUTION-PLAN-20261122.md) · [Cadastro e progresso do multi-org](../engineering/WBS-MULTIORG-PRODUCTION-READINESS-20261119.md) · [Inventário do DevServer01](https://github.com/delmacy/syndes-system/actions/runs/45175296771)

### Minha revisão

| Área | Proposta para revisar | Minha alteração |
| --- | --- | --- |
| Primeira entrega | Demonstrar multi-org e funil de atendimento em uma conta de teste. | |
| Estrutura da conta | Manter organizações e workspaces com acesso próprio. | |
| Workspace | Dar à equipe um ponto de entrada para CRM, Inbox e atendimentos. | |
| Platform Manager | Começar pelo catálogo de clientes e pela situação de cada conta. | |
| Funil | Permitir configurar etapas, atribuir responsável e ver andamento e histórico. | |
| Staging | Usar dados de teste e acesso privado durante a homologação. | |

**Primeira demonstração que quero ver funcionar**

> Escreva aqui.

**O que deve ficar para depois**

> Escreva aqui.

### Partes seguintes

- Parte 2 · Conta, organizações, workspaces e permissões.
- Parte 3 · WhatsApp, Inbox, CRM e funil de atendimento.
- Parte 4 · Platform Manager e cadastro de clientes.
- Parte 5 · Ambientes, testes e critérios de entrega.
