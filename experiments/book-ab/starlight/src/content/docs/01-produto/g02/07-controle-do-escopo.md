---
title: "G02 · Controle de escopo"
description: "Volume Produto e módulos de negócio · capítulo G02 · matéria 07"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/07-controle-do-escopo.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 7. Controle do escopo e divergências

**Revisão G02 não aprova novo requisito, nova sprint nem deploy.** Concilia decisões já registradas e classifica suas limitações.

### Conflitos e ambiguidade a encaminhar ao owner

| Divergência observada | Origem | Tratamento e responsável |
|---|---|---|
| **Escopo comercial amplo versus entregas iniciais** | [MVP-SCOPE](https://github.com/delmacy/syndes-system/blob/main/docs/product/MVP-SCOPE.md) inclui Scheduling, IA, Documents, Email, Billing e Website; [MODULE-ORDER](https://github.com/delmacy/syndes-system/blob/main/docs/product/MODULE-ORDER.md) prioriza um por vez | Manter escopo comercial, mas não exibir módulos posteriores como instalados ou ativos. G02/owners validam gates |
| **CRM tecnicamente avançado, aceite de produto pendente** | [CORE-CRM-MVP-ACCEPTANCE](https://github.com/delmacy/syndes-system/blob/main/docs/product/CORE-CRM-MVP-ACCEPTANCE.md) e [frontend completion](https://github.com/delmacy/syndes-system/blob/main/docs/product/CORE-CRM-FRONTEND-COMPLETION.md) | Conferir CI/código atuais, E2E real e usabilidade em P01/Q04; não marcar DONE por checklist antigo |
| **Inbox: documentos históricos descrevem polling, atualização posterior descreve SSE** | [PRD-002](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-002-INBOX-ACCEPTANCE.md) e [INBOX-FRONTEND-PROGRESS](https://github.com/delmacy/syndes-system/blob/main/docs/product/INBOX-FRONTEND-PROGRESS.md) | Reconhecer **SSE implementado/testado localmente** na revisão posterior; E2E e release ainda dependem de validação de P02 |
| **Funil Basic aprovado versus criador completo congelado** | [PRD-003A](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md), [proposta F0–F8](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-FUNNELS-AND-TEMPLATES-PROPOSAL.md) | Manter apenas Basic no MVP, sem telas/contratos automáticos de editor visual ou templates avançados |
| **Organização operacional versus CRM Organization** | [ADR frontend/backend](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md) | Diferenciar rótulos, IDs, fonte de dados e autorização; não ligar tabelas por nomenclatura |
| **Support Syndes versus atendimento do cliente** | [PRD Support](https://github.com/delmacy/syndes-system/blob/main/docs/product/PRD-SYNDES-SUPPORT.md) e PRD-003A | P06 pertence à operação da plataforma; P05 ao domínio de atendimento Basic do produto |
| **Interface visível versus capability habilitada** | ADR frontend, catalog/entitlements e módulo de autorização | UI deve mostrar capacidade efetivamente disponível, sem usar a visibilidade de menu como guarda de segurança |

### Classificação obrigatória na proposta de produto

- **MVP aprovado:** requisito explicitamente presente na baseline/PRD e com dono definido.
- **MVP planejado:** no escopo comercial, mas sem implementação/aceite verificado.
- **Código encontrado:** arquivo/fluxo no checkout, sem assumir implantação.
- **Teste local verificado:** resultado e SHA/ambiente específicos, não substitui E2E real.
- **Product Gate / homologação:** somente decisão de aprovação vinculada a evidência operacional.
- **Pós-MVP:** permanecer congelado até decisão explícita; um mock de tela não autoriza construção.

### Critério da revisão atual

G02 está **em auditoria documental parcial**: decisões, PRDs e fonte de UI confrontados com a revisão Git `36b7ebeabee236196e71b2f43f2ee92a4e0b49c9`. Não houve navegador autenticado, conexão ao banco, migração, teste de privacidade, produção ou aceite com usuário. Dados comerciais e preços da baseline são **planejados**, não confirmação de oferta ativada.

**Próxima unidade documental:** G03 — Engenharia/colaboração e contrato de alterações. Divergências de P01/P02/P05/A01–A03 serão tratadas pelos seus owners, sem editar módulos de produto nesta frente.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G02-produto-e-ux/chapters/07-controle-do-escopo.md).
